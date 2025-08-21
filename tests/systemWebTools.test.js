"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
// Import system and web tools
const executeTerminal_1 = require("../src/tools/executeTerminal");
const readPdf_1 = require("../src/tools/readPdf");
const readWebpageAsHTML_1 = require("../src/tools/readWebpageAsHTML");
const readWebpageAsMarkdown_1 = require("../src/tools/readWebpageAsMarkdown");
const searchPattern_1 = require("../src/tools/searchPattern");
suite('System and Web Tools Tests', () => {
    suite('ExecuteTerminalTool', () => {
        let tool;
        setup(() => {
            tool = new executeTerminal_1.ExecuteTerminalTool();
        });
        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'execute_terminal');
            assert.strictEqual(info.displayName, 'Execute Terminal');
            assert.strictEqual(info.category, 'system');
            assert.strictEqual(typeof info.description, 'string');
        });
        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'execute_terminal');
            assert.ok(definition.function.parameters.required.includes('command'));
        });
    });
    suite('ReadWebpageAsHTMLTool', () => {
        let tool;
        setup(() => {
            tool = new readWebpageAsHTML_1.ReadWebpageAsHTMLTool();
        });
        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'read_webpage_as_html');
            assert.strictEqual(info.displayName, 'Read Webpage as HTML');
            assert.strictEqual(info.category, 'web');
            assert.strictEqual(typeof info.description, 'string');
        });
        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'read_webpage_as_html');
            assert.strictEqual(typeof definition.function.description, 'string');
            assert.strictEqual(definition.function.parameters.type, 'object');
            assert.ok(definition.function.parameters.properties.url);
            assert.ok(definition.function.parameters.properties.max_length);
            assert.ok(definition.function.parameters.required?.includes('url'));
        });
        test('should handle invalid URL gracefully', async () => {
            const result = await tool.execute({ url: 'invalid-url' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
            assert.ok(result.error.length > 0);
        });
        test('should handle malformed URL gracefully', async () => {
            const result = await tool.execute({ url: 'not-a-url-at-all' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });
        test('should handle non-existent domain gracefully', async () => {
            const result = await tool.execute({
                url: 'https://this-domain-definitely-does-not-exist-12345.com'
            }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });
        test('should handle max_length parameter', async () => {
            // Use an invalid URL but test that the parameter is accepted
            const result = await tool.execute({
                url: 'invalid-url',
                max_length: 100
            }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });
        test('should preserve HTML structure when cleaning content', async () => {
            // Test with mock HTML content simulation
            // Since we can't rely on external URLs in tests, we test the error handling
            const result = await tool.execute({ url: 'https://httpbin.org/html' }, '/tmp');
            // Either succeeds with HTML content or fails gracefully
            if (result.success) {
                assert.strictEqual(typeof result.content, 'string');
                // HTML content should not contain script or style tags after cleaning
                assert.ok(!result.content.includes('<script'));
                assert.ok(!result.content.includes('<style'));
            }
            else {
                assert.strictEqual(typeof result.error, 'string');
            }
        });
    });
    suite('ReadWebpageAsMarkdownTool', () => {
        let tool;
        setup(() => {
            tool = new readWebpageAsMarkdown_1.ReadWebpageAsMarkdownTool();
        });
        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'read_webpage_as_markdown');
            assert.strictEqual(info.displayName, 'Read Webpage as Markdown');
            assert.strictEqual(info.category, 'web');
            assert.strictEqual(typeof info.description, 'string');
            assert.ok(info.description.includes('Markdown'));
        });
        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'read_webpage_as_markdown');
            assert.strictEqual(typeof definition.function.description, 'string');
            assert.strictEqual(definition.function.parameters.type, 'object');
            assert.ok(definition.function.parameters.properties.url);
            assert.ok(definition.function.parameters.properties.max_length);
            assert.ok(definition.function.parameters.required?.includes('url'));
        });
        test('should handle invalid URL gracefully', async () => {
            const result = await tool.execute({ url: 'invalid-url' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
            assert.ok(result.error.length > 0);
        });
        test('should handle malformed URL gracefully', async () => {
            const result = await tool.execute({ url: 'not-a-url-at-all' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });
        test('should handle non-existent domain gracefully', async () => {
            const result = await tool.execute({
                url: 'https://this-domain-definitely-does-not-exist-12345.com'
            }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });
        test('should handle max_length parameter', async () => {
            // Use an invalid URL but test that the parameter is accepted
            const result = await tool.execute({
                url: 'invalid-url',
                max_length: 200
            }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });
        test('should convert HTML to Markdown format', async () => {
            // Test with mock HTML content simulation
            // Since we can't rely on external URLs in tests, we test the error handling
            const result = await tool.execute({ url: 'https://httpbin.org/html' }, '/tmp');
            // Either succeeds with Markdown content or fails gracefully
            if (result.success) {
                assert.strictEqual(typeof result.content, 'string');
                // Markdown content should not contain HTML tags
                assert.ok(!result.content.includes('<html'));
                assert.ok(!result.content.includes('<div'));
                assert.ok(!result.content.includes('<script'));
                assert.ok(!result.content.includes('<style'));
                // Should contain markdown formatting
                // Note: This test may vary based on the actual content returned
            }
            else {
                assert.strictEqual(typeof result.error, 'string');
            }
        });
        test('should properly truncate content with max_length', async () => {
            // Test that truncation works correctly
            const result = await tool.execute({
                url: 'https://httpbin.org/html',
                max_length: 50
            }, '/tmp');
            if (result.success) {
                assert.strictEqual(typeof result.content, 'string');
                // Allow some margin for truncation message - content should be around max_length
                assert.ok(result.content.length <= 70); // Allow margin for "... (truncated)"
                if (result.content.includes('(truncated)')) {
                    // If truncated, the original content should have been close to max_length
                    const contentWithoutTruncMsg = result.content.replace(/\n\n\.\.\. \(truncated\)$/, '');
                    assert.ok(contentWithoutTruncMsg.length <= 55); // Allow small margin
                }
            }
            else {
                // Network error is acceptable in tests
                assert.strictEqual(typeof result.error, 'string');
            }
        });
    });
    suite('ReadPdfTool', () => {
        let tool;
        setup(() => {
            tool = new readPdf_1.ReadPdfTool();
        });
        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'read_pdf');
            assert.strictEqual(info.displayName, 'Read PDF');
            assert.strictEqual(info.category, 'file');
            assert.strictEqual(typeof info.description, 'string');
        });
        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'read_pdf');
            assert.ok(definition.function.parameters.required.includes('path'));
        });
    });
    suite('SearchPatternTool', () => {
        let tool;
        setup(() => {
            tool = new searchPattern_1.SearchPatternTool();
        });
        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'search_pattern');
            assert.strictEqual(info.displayName, 'Search Pattern');
            assert.strictEqual(info.category, 'search');
            assert.strictEqual(typeof info.description, 'string');
        });
        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'search_pattern');
            assert.ok(definition.function.parameters.required.includes('pattern'));
        });
    });
});
//# sourceMappingURL=systemWebTools.test.js.map