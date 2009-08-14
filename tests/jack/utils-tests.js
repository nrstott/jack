var assert = require("test/assert"),
    Utils = require("jack/utils"),
    MockRequest = require("jack/mock").MockRequest,
    File = require("file"),
    BinaryIO = require("binary").BinaryIO;

exports.testUnescape = function() {
    assert.isEqual("fo<o>bar", Utils.unescape("fo%3Co%3Ebar"));
    assert.isEqual("a space", Utils.unescape("a%20space"));
    assert.isEqual("a+space", Utils.unescape("a+space"));
    assert.isEqual("a+space", Utils.unescape("a+space", false));
    assert.isEqual("a space", Utils.unescape("a+space", true));
    assert.isEqual("q1!2\"'w$5&7/z8)?\\", Utils.unescape("q1%212%22%27w%245%267%2Fz8%29%3F%5C"));
}

// [ wonkyQS, canonicalQS, obj ]
var qsTestCases = [
    ["foo=bar",  "foo=bar", {"foo" : "bar"}],
    ["foo=bar&foo=quux", "foo%5B%5D=bar&foo%5B%5D=quux", {"foo" : ["bar", "quux"]}],
    ["foo=1&bar=2", "foo=1&bar=2", {"foo" : "1", "bar" : "2"}],
    ["my+weird+field=q1%212%22%27w%245%267%2Fz8%29%3F", "my%20weird%20field=q1!2%22'w%245%267%2Fz8)%3F", {"my weird field" : "q1!2\"'w$5&7/z8)?" }],
    ["foo%3Dbaz=bar", "foo%3Dbaz=bar", {"foo=baz" : "bar"}],
    ["foo=baz=bar", "foo=baz%3Dbar", {"foo" : "baz=bar"}],
    ["str=foo&arr[]=1&arr[]=2&arr[]=3&obj[a]=bar&obj[b][]=4&obj[b][]=5&obj[b][]=6&obj[b][]=&obj[c][]=4&obj[c][]=5&obj[c][][somestr]=baz&obj[objobj][objobjstr]=blerg&somenull=&undef=", "str=foo&arr%5B%5D=1&arr%5B%5D=2&arr%5B%5D=3&obj%5Ba%5D=bar&obj%5Bb%5D%5B%5D=4&obj%5Bb%5D%5B%5D=5&obj%5Bb%5D%5B%5D=6&obj%5Bb%5D%5B%5D=&obj%5Bc%5D%5B%5D=4&obj%5Bc%5D%5B%5D=5&obj%5Bc%5D%5B%5D%5Bsomestr%5D=baz&obj%5Bobjobj%5D%5Bobjobjstr%5D=blerg&somenull=&undef=", {
        "str":"foo",
        "arr":["1","2","3"],
        "obj":{
            "a":"bar",
            "b":["4","5","6",""],
            "c":["4","5",{"somestr":"baz"}],
            "objobj":{"objobjstr":"blerg"}
        },
        "somenull":"",
        "undef":""
    }],
    ["foo[bar][bla]=baz&foo[bar][bla]=blo", "foo%5Bbar%5D%5Bbla%5D%5B%5D=baz&foo%5Bbar%5D%5Bbla%5D%5B%5D=blo", {"foo":{"bar":{"bla":["baz","blo"]}}}],
    ["foo[bar][][bla]=baz&foo[bar][][bla]=blo", "foo%5Bbar%5D%5B%5D%5Bbla%5D=baz&foo%5Bbar%5D%5B%5D%5Bbla%5D=blo", {"foo":{"bar":[{"bla":"baz"},{"bla":"blo"}]}}],
    ["foo[bar][bla][]=baz&foo[bar][bla][]=blo", "foo%5Bbar%5D%5Bbla%5D%5B%5D=baz&foo%5Bbar%5D%5Bbla%5D%5B%5D=blo", {"foo":{"bar":{"bla":["baz","blo"]}}}],
    [" foo = bar ", "foo=bar", {"foo":"bar"}]
];
var qsColonTestCases = [
    ["foo:bar", "foo:bar", {"foo":"bar"}],
    ["foo:bar;foo:quux", "foo%5B%5D:bar;foo%5B%5D:quux", {"foo" : ["bar", "quux"]}],
    ["foo:1&bar:2;baz:quux", "foo:1%26bar%3A2;baz:quux", {"foo":"1&bar:2", "baz":"quux"}],
    ["foo%3Abaz:bar", "foo%3Abaz:bar", {"foo:baz":"bar"}],
    ["foo:baz:bar", "foo:baz%3Abar", {"foo":"baz:bar"}]
];
exports.testParseQuery = function() {
    qsTestCases.forEach(function (testCase) {
        assert.isSame(testCase[2], Utils.parseQuery(testCase[0]));
    });
    qsColonTestCases.forEach(function (testCase) {
        assert.isSame(testCase[2], Utils.parseQuery(testCase[0], ";", ":"))
    });
}
exports.testToQueryString = function () {
    qsTestCases.forEach(function (testCase) {
        assert.isSame(testCase[1], Utils.toQueryString(testCase[2]));
    });
    qsColonTestCases.forEach(function (testCase) {
        assert.isSame(testCase[1], Utils.toQueryString(testCase[2], ";", ":"));
    });
};

// specify "should return nil if content type is not multipart" do
exports.testNotMultipart = function() {
    var env = MockRequest.envFor(null, "/", { "CONTENT_TYPE" : "application/x-www-form-urlencoded" });
    assert.isNull(Utils.parseMultipart(env));
}

// specify "should parse multipart upload with text file" do
exports.testMultipart = function() {
    var env = MockRequest.envFor(null, "/", multipart_fixture("text"));
    var params = Utils.parseMultipart(env);
    
    assert.isEqual("Larry", params["submit-name"]);
    assert.isEqual("text/plain", params["files"]["type"]);
    assert.isEqual("file1.txt", params["files"]["filename"]);
    assert.isEqual(
        "Content-Disposition: form-data; " +
        "name=\"files\"; filename=\"file1.txt\"\r\n" +
        "Content-Type: text/plain\r\n",
        params["files"]["head"]);
    assert.isEqual("files", params["files"]["name"]);
    //assert.isEqual("contents", params["files"]["tempfile"]);
}

//specify "should parse multipart upload with nested parameters" do
/*
exports.testMultipartNested = function() {
    var env = MockRequest.envFor(null, "/", multipart_fixture("nested"))
    var params = Utils.parseMultipart(env);
    
    assert.isEqual("Larry", params["foo"]["submit-name"]);
    assert.isEqual("text/plain", params["foo"]["files"]["type"]);
    assert.isEqual("file1.txt", params["foo"]["files"]["filename"]);
    assert.isEqual(
        "Content-Disposition: form-data; " +
        "name=\"foo[files]\"; filename=\"file1.txt\"\r\n" +
        "Content-Type: text/plain\r\n",
        params["foo"]["files"]["head"]);
    assert.isEqual("foo[files]", params["foo"]["files"]["name"]);
    assert.isEqual("contents", File.read(params["foo"]["files"]["tempfile"]));
}
//*/

// specify "should parse multipart upload with binary file" do
exports.testMultipartBinaryFile = function() {
    var env = MockRequest.envFor(null, "/", multipart_fixture("binary"));
    var params = Utils.parseMultipart(env);
    
    assert.isEqual("Larry", params["submit-name"]);
    assert.isEqual("image/png", params["files"]["type"]);
    assert.isEqual("rack-logo.png", params["files"]["filename"]);
    assert.isEqual(
        "Content-Disposition: form-data; " +
        "name=\"files\"; filename=\"rack-logo.png\"\r\n" +
        "Content-Type: image/png\r\n",
        params["files"]["head"]);
    assert.isEqual("files", params["files"]["name"]);
    assert.isEqual(26473, File.read(params["files"]["tempfile"], "b").length);
}

// specify "should parse multipart upload with empty file" do
exports.testMultipartEmptyFile = function() {
    var env = MockRequest.envFor(null, "/", multipart_fixture("empty"));
    var params = Utils.parseMultipart(env);
    
    assert.isEqual("Larry", params["submit-name"]);
    assert.isEqual("text/plain", params["files"]["type"]);
    assert.isEqual("file1.txt", params["files"]["filename"]);
    assert.isEqual(
        "Content-Disposition: form-data; " +
        "name=\"files\"; filename=\"file1.txt\"\r\n" +
        "Content-Type: text/plain\r\n",
        params["files"]["head"]);
    assert.isEqual("files", params["files"]["name"]);
    assert.isEqual("", File.read(params["files"]["tempfile"]));
}

// specify "should not include file params if no file was selected" do
exports.testMultipartNoFile = function() {
    var env = MockRequest.envFor(null, "/", multipart_fixture("none"));
    var params = Utils.parseMultipart(env);
    
    assert.isEqual("Larry", params["submit-name"]);
    assert.isNull(params["files"]);
    //params.keys.should.not.include "files"
}

// specify "should parse IE multipart upload and clean up filename" do
exports.testMultipartIEFile = function() {
    var env = MockRequest.envFor(null, "/", multipart_fixture("ie"));
    var params = Utils.parseMultipart(env);
    
    assert.isEqual("text/plain", params["files"]["type"]);
    assert.isEqual("file1.txt", params["files"]["filename"]);
    assert.isEqual(
        "Content-Disposition: form-data; " +
        "name=\"files\"; " +
        'filename="C:\\Documents and Settings\\Administrator\\Desktop\\file1.txt"' +
        "\r\nContent-Type: text/plain\r\n",
        params["files"]["head"]);
    assert.isEqual("files", params["files"]["name"]);
    assert.isEqual("contents", File.read(params["files"]["tempfile"], "b").decodeToString());
}

function multipart_fixture(name) {
    var file = multipart_file(name);
    var data = File.read(file, 'rb');
    
    var type = "multipart/form-data; boundary=AaB03x";
    var length = data.length;

    return {
        "CONTENT_TYPE" : type,
        "CONTENT_LENGTH" : length.toString(10),
        "jack.input" : new BinaryIO(data)
    }
}

function multipart_file(name) {
    return File.join(File.dirname(require.fileName), "multipart", name);
}