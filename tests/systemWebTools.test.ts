import * as assert from 'assert';

// Import system and web tools
import { ExecuteTerminalTool } from '../src/tools/executeTerminal';
import { ReadPdfTool } from '../src/tools/readPdf';
import { ReadWebpageAsHTMLTool } from '../src/tools/readWebpageAsHTML';
import { ReadWebpageAsMarkdownTool } from '../src/tools/readWebpageAsMarkdown';
import { SearchPatternTool } from '../src/tools/searchPattern';

suite('System and Web Tools Tests', () => {
    suite('ExecuteTerminalTool', () => {
        let tool: ExecuteTerminalTool;

        setup(() => {
            tool = new ExecuteTerminalTool();
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
        let tool: ReadWebpageAsHTMLTool;

        setup(() => {
            tool = new ReadWebpageAsHTMLTool();
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
            assert.ok(result.error!.length > 0);
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
            } else {
                assert.strictEqual(typeof result.error, 'string');
            }
        });
    });

    suite('ReadWebpageAsMarkdownTool', () => {
        let tool: ReadWebpageAsMarkdownTool;

        setup(() => {
            tool = new ReadWebpageAsMarkdownTool();
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
            assert.ok(result.error!.length > 0);
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
            } else {
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
            } else {
                // Network error is acceptable in tests
                assert.strictEqual(typeof result.error, 'string');
            }
        });
    });

    suite('ReadPdfTool', () => {
        let tool: ReadPdfTool;

        setup(() => {
            tool = new ReadPdfTool();
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
        let tool: SearchPatternTool;

        setup(() => {
            tool = new SearchPatternTool();
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
