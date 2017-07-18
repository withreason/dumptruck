#!/usr/bin/env node
const chalk         = require('chalk');
const clear         = require('clear');
const CLI           = require('clui');
const figlet        = require('figlet');
const path          = require('path');
const inquirer      = require('inquirer');
const inquirerauto  = require('inquirer-autocomplete-prompt');
const Preferences   = require('preferences');
const Spinner       = CLI.Spinner;
const _             = require('lodash');
const touch         = require('touch');
const fs            = require('fs');
const files         = require('./lib/files');
const AWS           = require('aws-sdk');
const awscred       = require('awscred');
const yaml          = require('js-yaml');
const fuzzy         = require('fuzzy');
const Promise       = require('promise');
const awsCredPath   = path.join(files.resolveHome(), '.aws', 'credentials');

inquirer.registerPrompt('autocomplete', inquirerauto);
var program = require('commander');

const localpath   = path.join(path.dirname(fs.realpathSync(__filename)));

program
.version('0.1.0')
.usage(figlet.textSync(' Dumptruck', { horizontalLayout: 'full', font:'ANSI Shadow'}))
.usage(`
    dumptruck (or dtrk for short) should guide you through the log selection process,
    argv flags coming soon.
`)
//.option('-p, --profile', 'Pre select AWS profile')
//.option('-r, --region', 'Pre select AWS region')
//.option('-l, --lambda', 'Pre select Lambda')
.parse(process.argv);

var prefs = new Preferences('dumptruck.io',{
    'awsProfile':false,
    'awsRegion':false,
    'awsLambda':false
});

const truckLoader = [
    '       🚛 ⣾',
    '      🚛  ⣽',
    '     🚛   ⣻',
    '    🚛    ⢿',
    '   🚛     ⡿',
    '  🚛      ⣟',
    ' 🚛       ⣯',
    '🚛        ⣷'
];

const awsLambdaRegions = [
    {'region':'US East (Ohio)','unique':'us-east-2'},
    {'region':'US East (N. Virginia)','unique':'us-east-1'},
    {'region':'US West (N. California)','unique':'us-west-1'},
    {'region':'US West (Oregon)','unique':'us-west-2'},
    {'region':'Asia Pacific (Seoul)','unique':'ap-northeast-2'},
    {'region':'Asia Pacific (Mumbai)','unique':'ap-south-1'},
    {'region':'Asia Pacific (Singapore)','unique':'ap-southeast-1'},
    {'region':'Asia Pacific (Sydney)','unique':'ap-southeast-2'},
    {'region':'Asia Pacific (Tokyo)','unique':'ap-northeast-1'},
    {'region':'Canada (Central)','unique':'ca-central-1'},
    {'region':'EU (Frankfurt)','unique':'eu-central-1'},
    {'region':'EU (Ireland)','unique':'eu-west-1'},
    {'region':'EU (London)','unique':'eu-west-2'},
    {'region':'South America (São Paulo)','unique':'sa-east-1'},
].map(r => {
    r.flat = (r.unique + ' ' + chalk.grey(r.region));
    return r;
});

let selectOptions = {
    region:false,
    lambda:false,
    region:false
};


const dateSort = function (a, b) {
    return Date.parse(b.LastModified) - Date.parse(a.LastModified);
};

var intro = ['',
    '  ╔════════════════════════════════════════════════════════════════════════════╗ ',
    '  ║   (c)  http://withreason.co.uk 2017 || Part of the http://sls.zone suite   ║ ',
    '  ╚════════════════════════════════════════════════════════════════════════════╝ ',
    '                                                                                '
];

clear();
console.log('\n' +
    chalk.red(
        figlet.textSync(' Dumptruck', { horizontalLayout: 'full', font:'ANSI Shadow'})
    ) + chalk.yellow(intro.join('\n'))
);

function getAWSProfiles(callback){
    let awsCredFile = fs.readFileSync(awsCredPath).toString();
    let matches = [];
    let foo = awsCredFile.replace(/\[(.*?)\]/g, function(g0,g1){matches.push(g1);});
    // prompt for AWS profile
    if (matches.length) {
        inquirer.prompt(
            [{
                type: 'list',
                name: 'awsProfile',
                message: 'Select AWS profile:',
                choices: matches.sort(),
                default: prefs.awsProfile || 'default'
            }]
        ).then(function( answer ) {
            prefs.awsProfile = answer.awsProfile;
            callback(false,answer.awsProfile);
        });
    } else {
        callback('No AWS config!    TODO : Let you add own config');
    }
}

function getAWSLambdaRegions(callback){
    inquirer.prompt(
        [{
            type: 'list',
            name: 'awsRegion',
            message: 'Select AWS Region:',
            choices: awsLambdaRegions.map(r => r.flat).sort(),
            default: prefs.awsRegion || false,
            pageSize: 20
        }]
    ).then(function( answer ) {
        prefs.awsRegion = answer.awsRegion;
        callback(false,answer.awsRegion);
    });
}

function getLambdaForYaml(err,callback){
    try {
        var doc = yaml.safeLoad(fs.readFileSync(localpath + '/serverless.yml', 'utf8'));
        inquirer.prompt(
            [{
                type: 'confirm',
                name: 'useYaml',
                message: 'Filter from local YAML file?',
                default: true
            }]
        ).then(function( answer ) {
            callback(false,answer.useYaml ? doc.service : false);
        });
    } catch (e) {
        callback(false,false);
    }
}

function getLambdaForProfile(err,callback){
    if(err || !selectOptions.profile){
        console.log(chalk.red(err || 'No Profile or Region'));
        process.exit();
    } else {
        var countdown = new Spinner('Cant find lamdba in current path, checking aws...  ', truckLoader);
        countdown.start();
        var credentials = new AWS.SharedIniFileCredentials({
            profile: selectOptions.profile
        });
        var lambda = new AWS.Lambda({
            credentials,
            region:selectOptions.region
        });
        var params = {
            MaxItems: 200
        };
        lambda.listFunctions(params, function(err, data) {
            countdown.stop();
            if (err){
                return callback(err,false)
            } else {
                return callback(false,data.Functions)
            }
        });
    }
}



function selectLamda(err,lambdas,callback){
    if(err || !lambdas){
        console.log(chalk.red(err || 'No Lamdbas Found'));
        process.exit();
    } else {
        function searchlambdas(answers, input) {
            input = input || '';
            return new Promise(function(resolve) {
                let flatLambdas = lambdas.sort(dateSort).map(f => f.FunctionName);
                if(prefs.awsLambda){
                    flatLambdas.sort((x,y)=> (x === prefs.awsLambda ? -1 : y === prefs.awsLambda ? 1 : 0));
                }
                if(selectOptions.filter){
                    flatLambdas = flatLambdas.filter(f => f.startsWith(selectOptions.filter));
                }
                var fuzzyResult = fuzzy.filter(input, flatLambdas);
                resolve(fuzzyResult.map(function(el) {
                    return el.original;
                }));
            });
        }
        inquirer.prompt([
            {
                type: 'autocomplete',
                name: 'Lambda',
                suggestOnly: false,
                message: 'Select Lambda:',
                source: searchlambdas,
                default: prefs.awsLambda || false,
                pageSize: 20
            }
        ]).then(function(answer) {
            if(answer){
                callback(false,answer.Lambda);
            } else {
                callback('No Lambda Selected');
            }
        });

    }

}


// todo: tidy this mess
function startlogs() {
    var bindCountdown = new Spinner('Binding to ' + selectOptions.lambda + ' in ' + selectOptions.region + '...  ', ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷']);
    bindCountdown.start();
    var lastEventIds = [];
    var credentials = new AWS.SharedIniFileCredentials({
        profile: selectOptions.profile
    });
    var cloudwatchlogs = new AWS.CloudWatchLogs({
        credentials,
        region: selectOptions.region
    });

    var initialParams = {
        logGroupName: '/aws/lambda/' + selectOptions.lambda,
        interleaved: true,
    };

    initialParams.startTime = new Date().getTime() - 60000;
    initialParams.endTime = new Date().getTime();


    function getLogs(params, nextToken) {
        if(!lastEventIds.length){
            clear();
            console.log('🚛   ' + chalk.underline('' + selectOptions.lambda + ' : ' + selectOptions.region + '\n'));
        }
        var pagedParams = _.clone(params);
        pagedParams.nextToken = nextToken;
        cloudwatchlogs.filterLogEvents(pagedParams, function (error, data) {
            bindCountdown.stop();
            if (error) {
                console.log(error)
            }
            // Trim the lastEventIds
            if (lastEventIds.length > 50) {
                lastEventIds = lastEventIds.slice(25);
            }
            if (data.events.length !== 0) {
                var lastDate;
                data.events.forEach(function (event) {
                    var ts = new Date(event.timestamp);
                    // Only print logs that have not already been printed
                    if (lastEventIds.indexOf(event.eventId) < 0) {
                        if (event.message.startsWith('START')) {
                            process.stdout.write(chalk.green.underline('\r\n' + ts + ' : ' + event.message))
                        } else if (event.message.startsWith('END')) {
                            process.stdout.write(chalk.red.underline(ts + ' : ' + event.message))
                        } else if (event.message.startsWith('REPORT')) {
                            process.stdout.write(chalk.bgWhite.magenta(ts + ' : REPORT 💰💰💰 '));
                            event.message.trim().split('\t').forEach(line => {
                                process.stdout.write(chalk.bgWhite.magenta('\r\n *** ' + line + ' '));
                            })
                            process.stdout.write(chalk.bgWhite.magenta(ts + '\r\n'));
                        } else {
                            process.stdout.write(event.message);
                        }

                        lastEventIds.push(event.eventId);
                    }
                    if (lastDate === undefined || lastDate < ts) {
                        lastDate = ts;
                    }
                });
                // Only change the start time if we actually received some events
                params.startTime = lastDate.getTime();
            }
            // Pageing support
            if (data.nextToken) {
                getLogs(params, data.nextToken);
            } else {
                params.endTime = new Date().getTime();
                setTimeout(getLogs, 1000, params)
            }
        })
    }
    getLogs(initialParams);
}

process.on('SIGINT', function() {
    console.log('\n' +
        chalk.red('Ok Bye')
    );
    process.exit();
});

// 1. Get AWS Profile
getAWSProfiles((err,profile)=>{
    selectOptions.profile = profile;
    getAWSLambdaRegions((err,region)=>{
        let matchedRegion = awsLambdaRegions.find(l => l.flat === region);
        selectOptions.region = matchedRegion.unique || false;
        getLambdaForYaml(err,(err,filter)=>{
            selectOptions.filter = filter;
            getLambdaForProfile(err,(err,lambdas)=>{
                selectLamda(err,lambdas,(err,lambda)=>{
                    prefs.awsLambda = lambda;
                    selectOptions.lambda = lambda;
                    startlogs();
                })
            })
        })
    })
});

/*

Todo:
1. Promisify
2. take in args https://www.npmjs.com/package/commander
3. detect lambda from current folder

*/