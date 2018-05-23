const figlet = require('figlet');
console.log(figlet.textSync(' Dumptruck', {
	horizontalLayout: 'full',
	font:'ANSI Shadow'
}));
console.log(`
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF
OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
`);
console.log(`
This tool uses locally stored AWS credentials to access your Lambda groups and Cloudwatch logs
via the AWS APIs and CLI tools.
At the time of writing, there are no hard rate limiting or pricing on these API requests,
if in the future, any limits or pricing is introduced, dumptruck.io and any associated parties
will NOT be held liable for any cost or API limit repercussions.
`);