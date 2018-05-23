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
const fs            = require('fs');
const files         = require('./lib/files');
const AWS           = require('aws-sdk');
const awscred       = require('awscred');
const yaml          = require('js-yaml');
const fuzzy         = require('fuzzy');
const Promise       = require('promise');
const awsCredPath   = path.join(files.resolveHome(), '.aws', 'credentials');
const exec          = require('child_process').exec;

inquirer.registerPrompt('autocomplete', inquirerauto);
var program = require('commander');

const localpath   = process.cwd();

program
.version('0.1.0')
.usage(figlet.textSync(' Dumptruck', { horizontalLayout: 'full', font:'ANSI Shadow'}))
.usage(`
    dumptruck should guide you through the log selection process.

    Or you can specify arguments:
    dumptruck -p  "default"  -r "eu-west-1" -l "your-lambda-name-here"

    Optional Arguments:
    -p, --profile   Pre select AWS profile
    -r, --region    Pre select AWS region
    -l, --lambda    Pre select Lambda
`)
.option('-p, --profile [value]', 'Pre select AWS profile')
.option('-r, --region [value]', 'Pre select AWS region')
.option('-l, --lambda [value]', 'Pre select Lambda')
.parse(process.argv);

var prefs = new Preferences('dumptruck.io',{
    'awsProfile':false,
    'awsRegion':false,
    'awsLambda':false
});

const truckAnimation = [
    '       🚛 ',
    '      🚛  ',
    '     🚛   ',
    '    🚛    ',
    '   🚛     ',
    '  🚛      ',
    ' 🚛       ',
    '🚛        '
];
const truckLoader = ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷'].map((l,k)=>(truckAnimation[k]+l));

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

function showIntro(){
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
}


function getAWSProfiles(callback){

    if (program.profile) callback(false,program.profile);


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

    if (program.region) return callback(false,program.region);

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

    if (program.lambda) return callback(false,false);


    try {
        var doc = yaml.safeLoad(fs.readFileSync(localpath + '/serverless.yml', 'utf8'));
        inquirer.prompt(
            [{
                type: 'confirm',
                name: 'useYaml',
                message: 'Filter from local YAML file? ' + doc.service,
                default: true
            }]
        ).then(function( answer ) {

            exec('serverless info', {cwd: localpath}, function(err, stdout, stderr) {
                let resolution = stdout.toString().split('Service Information');
                let functionsList = false;
                if(resolution.length > 0){
                    let slslInfoYaml = yaml.safeLoad(resolution[1]);
                    functionsList = slslInfoYaml.functions ? Object.keys(slslInfoYaml.functions).map(fnkey=>{
                        return slslInfoYaml.functions[fnkey];
                    }) : false;
                }
                callback(false,answer.useYaml ? functionsList : false);
            });

        });
    } catch (e) {
        callback(false,false);
    }
}

function getLambdaForProfile(err,callback){

    if (program.lambda) return callback(false,false);

    if(err || !selectOptions.profile){
        console.log(chalk.red(err || 'No Profile or Region'));
        process.exit();
    } else {
        var countdown = new Spinner('Fetching lambda list from AWS ...  ', truckLoader);
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

    if (program.lambda) return callback(false,program.lambda);

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
                    flatLambdas = flatLambdas.filter(f => (selectOptions.filter.indexOf(f) > -1));
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
        var pagedParams = Object.assign({},params);
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
    let prevOpts = [
        'dumptruck -p ',
        '"' + prefs.awsProfile + '"',
        ' -r',
        '"' + prefs.awsRegion.split(' ')[0] + '"',
        '-l',
        '"' + prefs.awsLambda + '"'
    ].join(' ');

    console.log('\n' +
        chalk.red('Ok Bye') +
        '\n' +
        chalk.grey('Want to invoke this log dumptruck again directly? use: ') +
        chalk.green(prevOpts)
    );
    process.exit();
});

function launchApp() {
    showIntro();
    if (!prefs.agreeTerms) {
        // terms
        let termsText = [chalk.grey('-------\n'),
        'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,',
        'EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES ',
        'OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND ',
        'NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS ',
        'BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN ',
        'AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF ',
        'OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS ',
        'IN THE SOFTWARE.',
        chalk.grey('\n-------\n'),
        'This tool uses locally stored AWS credentials to access your Lambda groups and Cloudwatch logs ',
        'via the AWS API\'s and CLI tools. \n',
        'At the time of writing, there are no hard rate limiting or pricing on these API requests, ',
        'if in the future, any limits or pricing is introduced, dumptruck.io and any associated parties ',
        'will NOT be held liable for any cost or API limit repercussions.',
        chalk.grey('\n-------\n'),
        ].join('');
        inquirer.prompt([
            {
                type: 'list',
                name: 'terms',
                message: chalk.red('Please read and agree to these terms of use before proceeding') + '\n' + termsText,
                choices: [
                    {value: false, name: chalk.grey('I have not read terms')},
                    {value: false, name: chalk.red('I have read terms, and DO NOT agree')},
                    {value: true, name: chalk.green('I have read terms and DO AGREE')},
                ]
            }
        ]).then(function (answer) {
            if (!answer.terms) {
                clear();
                console.log('\n' + chalk.green('http://dumptruck.io  🚛\nPlease agree to terms before use'));
                process.exit();
            } else {
                prefs.agreeTerms = true;
                clear();
                launchApp();
            }
        });
    } else {
        // 1. Get AWS Profile
        getAWSProfiles((err, profile) => {
            selectOptions.profile = profile;
            getAWSLambdaRegions((err, region) => {
                if (program.region){
                    selectOptions.region = program.region
                } else {
                    let matchedRegion = awsLambdaRegions.find(l => l.flat === region);
                    selectOptions.region = matchedRegion.unique || false;
                }

                getLambdaForYaml(err, (err, filter) => {
                    selectOptions.filter = filter;
                    getLambdaForProfile(err, (err, lambdas) => {
                        selectLamda(err, lambdas, (err, lambda) => {
                            prefs.awsLambda = lambda;
                            selectOptions.lambda = lambda;
                            startlogs();
                        })
                    })
                })
            })
        });
    }
}
launchApp();

/*

Todo:
1. Promisify
2. take in args https://www.npmjs.com/package/commander
3. detect lambda from current folder

*/