```

    ██████╗ ██╗   ██╗███╗   ███╗██████╗ ████████╗██████╗ ██╗   ██╗ ██████╗██╗  ██╗
    ██╔══██╗██║   ██║████╗ ████║██╔══██╗╚══██╔══╝██╔══██╗██║   ██║██╔════╝██║ ██╔╝
    ██║  ██║██║   ██║██╔████╔██║██████╔╝   ██║   ██████╔╝██║   ██║██║     █████╔╝
    ██║  ██║██║   ██║██║╚██╔╝██║██╔═══╝    ██║   ██╔══██╗██║   ██║██║     ██╔═██╗
    ██████╔╝╚██████╔╝██║ ╚═╝ ██║██║        ██║   ██║  ██║╚██████╔╝╚██████╗██║  ██╗
    ╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚═╝        ╚═╝   ╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝

  ╔════════════════════════════════════════════════════════════════════════════╗
  ║   (c)  http://withreason.co.uk 2018 || Part of the http://sls.zone suite   ║
  ╚════════════════════════════════════════════════════════════════════════════╝

```

http://dumptruck.io

A Node CLI Helper to fetch Lambda logs from Cloudwatch.

To get started, `npm install dumptruck -g`.

To view logs, simply run `dumptruck`. If you are in a serverless project,
it will try to pull config from your `serverless.yaml`.

Once dumptruck has launched, it will guide you through prompts to select
the correct log group, these selections are made with your keyboard and are
remembered locally, for ease of access on future launches.

1. Select AWS profile
2. Select AWS Region
3. Filter from local YAML file (if serverless.yaml is present in current folder)
4. Select your Lambda (Ordered by most recently updated)

Once a Lambda has been selected, this will poll AWS for the latest events,
There is still some slight lag as events go from your lamdba to Cloudwatch.

Once you close a log stream (`ctrl+c`) you are presented with a direct invocation command incase you wish to skip the option selection when targeting the same lambda again.

```
dumptruck -p  "default"  -r "eu-west-1" -l "your-lambda-name-here"
```

Please note that product is still in development, and that by installing and/or using dumptruck you agree to the following:

```
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF
OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
```
```
This tool uses locally stored AWS credentials to access your Lambda groups and Cloudwatch logs
via the AWS API's and CLI tools.
At the time of writing, there are no hard rate limiting or pricing on these API requests,
if in the future, any limits or pricing is introduced, dumptruck.io and any associated parties
will NOT be held liable for any cost or API limit repercussions.
```