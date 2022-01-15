const WDIOReporter = require('@wdio/reporter').default
const fs = require('fs')
const path = require('path')
const tesults = require('tesults')

module.exports.default = class TesultsReporter extends WDIOReporter {
    constructor(options) {
        options = Object.assign(options, { stdout: true })
        super(options)
        this.data = {
            target: 'token',
            results: {
              cases: []
            }
          };
        this.disabled = false
        this.complete = true
        this.files = undefined
    }
    caseFiles (suite, name) {
        let files = [];
        if (this.options['tesults-files'] !== undefined) {
          try {
            const filesPath = path.join(this.options['tesults-files'], suite, name);
            fs.readdirSync(filesPath).forEach(function (file) {
              if (file !== ".DS_Store") { // Exclude os files
                files.push(path.join(filesPath, file));
              }
            });
          } catch (err) { 
            if (err.code === 'ENOENT') {
              // Normal scenario where no files present
            } else {
              console.log('Tesults error reading case files.')
              console.log(err)
            }
          }
        }
        return files;
    }
    get isSynchronised () {
        return this.complete
    }
    onRunnerStart() {
        let token = this.options["tesults-target"]
        if (token === undefined || token === null || token === "") {
            this.disabled = true
            this.write("Tesults disabled. No target token supplied.\n")
        } else {
            this.data.target = token
        }
    }
    onBeforeCommand() {}
    onAfterCommand() {}
    onSuiteStart() {}
    onHookStart() {}
    onHookEnd() {}
    onTestStart() {}
    onTestPass() {}
    onTestFail() {}
    onTestSkip() {}
    onTestEnd(test) {
        const result = (rawResult) => {
            if (rawResult === "passed") {
                return "pass"
            } else if (rawResult === "failed") {
                return "fail"
            } else {
                return "unknown"
            }
        }
        let testCase = {
            name: test.title,
            suite: test.parent,
            result: result(test.state),
            rawResult: test.state,
            start: (new Date(test.end)).getTime(),
            end: (new Date(test.end)).getTime(),
            duration: test.duration,
            _retries: test.retries,
            _cid: test.cid,
            _uid: test.uid,
            _type: test.type
        }
        let files = this.caseFiles(test.parent, test.title)
        if (files.length > 0) {
            testCase.files = files
        }
        if (test.data !== undefined) {
            testCase["_wdio_data"] = test.data
        }
        this.data.results.cases.push(testCase)
    }
    onSuiteEnd() {}
    onRunnerEnd(data) {
        if (this.disabled === true) {
            return
        }
        const buildSuite = "[build]"
        const buildName = this.options["tesults-build-name"]
        const buildResult = this.options["tesults-build-result"]
        const buildDesc = this.options["tesults-build-description"]
        const buildReason = this.options["tesults-build-reason"]
        if (buildName !== undefined) {
            let buildCase = {}
            buildCase.suite = buildSuite
            buildCase.name = buildName
            buildCase.result = "unknown"
            if (buildDesc !== undefined) {
                buildCase.desc = buildDesc
            }
            if (buildResult !== undefined) {
                if (buildResult === "pass" || buildResult === "fail") {
                    buildCase.result = buildResult
                }
            }
            if (this.options["tesults-build-reason"] !== undefined) {
                buildCase.reason = buildReason
            }
            let buildCaseFiles = this.caseFiles(buildSuite, buildName)
            if (buildCaseFiles.length > 0) {
                buildCase.files = buildCaseFiles
            }
            try {
                buildCase["_wdio_data"] = JSON.stringify(data)
            } catch (err) {
                // Ignore
            }
            this.data.results.cases.push(buildCase)
        }
        this.complete = false
        this.write("Tesults results upload...\n")
        tesults.results(this.data, (err, response) => {
            if (err) {
                this.write('Tesults library error, failed to upload.');
            } else {
                this.write('Success: ' + response.success + '\n');
                this.write('Message: ' + response.message + '\n');
                this.write('Warnings: ' + response.warnings.length + '\n');
                this.write('Errors: ' + response.errors.length + '\n');
            }
            this.complete = true
        })
    }
}
