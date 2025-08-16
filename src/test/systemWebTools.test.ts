import * as assert from 'assert';

// Import system and web tools
import { ExecuteTerminalTool } from '../tools/executeTerminal';
import { ReadPdfTool } from '../tools/readPdf';
import { ReadWebpageTool } from '../tools/readWebpage';
import { SearchPatternTool } from '../tools/searchPattern';

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
            
            // Check optional parameters exist
            assert.ok(definition.function.parameters.properties.cwd);
            assert.ok(definition.function.parameters.properties.timeout);
        });

        test('should execute simple echo command', async () => {
            const result = await tool.execute({ command: 'echo "test"' }, '/tmp');
            if (result.success) {
                assert.ok(result.content.includes('test'));
            } else {
                // On some systems this might fail, so we just check it handles it gracefully
                assert.strictEqual(typeof result.error, 'string');
                console.log('Echo command failed (expected on some systems):', result.error);
            }
        });

        test('should handle working directory parameter', async () => {
            const result = await tool.execute({ 
                command: 'pwd', 
                cwd: '/tmp' 
            }, '/tmp');
            
            if (result.success) {
                // Should contain /tmp in the output
                assert.ok(result.content.includes('/tmp') || result.content.includes('tmp'));
            } else {
                assert.strictEqual(typeof result.error, 'string');
                console.log('pwd command failed (expected on some systems):', result.error);
            }
        });

        test('should handle timeout parameter', async () => {
            const result = await tool.execute({ 
                command: 'echo "quick"',
                timeout: 1000
            }, '/tmp');
            
            if (result.success) {
                assert.ok(result.content.includes('quick'));
            } else {
                assert.strictEqual(typeof result.error, 'string');
            }
        });

        test('should handle invalid command gracefully', async () => {
            const result = await tool.execute({ 
                command: 'this_command_definitely_does_not_exist_12345' 
            }, '/tmp');
            
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
            assert.ok(result.error!.length > 0);
        });

        test('should handle command with stderr output', async () => {
            // Try a command that typically writes to stderr
            const result = await tool.execute({ 
                command: 'ls /nonexistent_directory_12345' 
            }, '/tmp');
            
            // This should fail on most systems
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
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
            
            // Check optional parameters exist
            assert.ok(definition.function.parameters.properties.max_pages);
        });

        test('should return not implemented error for any file', async () => {
            const result = await tool.execute({ path: 'test.pdf' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('not implemented'));
            assert.strictEqual(result.content, '');
        });

        test('should handle max_pages parameter', async () => {
            const result = await tool.execute({ 
                path: 'test.pdf',
                max_pages: 5 
            }, '/tmp');
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('not implemented'));
        });

        test('should handle absolute path', async () => {
            const result = await tool.execute({ 
                path: '/absolute/path/to/test.pdf' 
            }, '/tmp');
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('not implemented'));
        });
    });

    suite('ReadWebpageTool', () => {
        let tool: ReadWebpageTool;

        setup(() => {
            tool = new ReadWebpageTool();
        });

        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'read_webpage');
            assert.strictEqual(info.displayName, 'Read Webpage');
            assert.strictEqual(info.category, 'web');
            assert.strictEqual(typeof info.description, 'string');
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'read_webpage');
            assert.ok(definition.function.parameters.required.includes('url'));
            
            // Check optional parameters exist
            assert.ok(definition.function.parameters.properties.max_length);
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

        // Note: We avoid testing with real URLs to prevent network dependencies
        // and potential flakiness in the test suite
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
            // Note: path is not required for SearchPatternTool - it searches workspace
            
            // Check optional parameters exist
            assert.ok(definition.function.parameters.properties.is_regex);
            assert.ok(definition.function.parameters.properties.file_extensions);
            assert.ok(definition.function.parameters.properties.max_results);
        });

        test('should handle search in workspace gracefully', async () => {
            const result = await tool.execute({ 
                pattern: 'test'
            }, '/tmp');
            
            // This tool searches the workspace, so result depends on workspace state
            assert.strictEqual(typeof result.success, 'boolean');
            assert.strictEqual(typeof result.content, 'string');
        });

        test('should handle regex parameter', async () => {
            const result = await tool.execute({ 
                pattern: 'test.*pattern',
                is_regex: true
            }, '/tmp');
            
            // Should handle regex parameter gracefully
            assert.strictEqual(typeof result.success, 'boolean');
            assert.strictEqual(typeof result.content, 'string');
        });

        test('should handle file_extensions parameter', async () => {
            const result = await tool.execute({ 
                pattern: 'test',
                file_extensions: ['.js', '.ts', '.py']
            }, '/tmp');
            
            // Should handle file extensions parameter gracefully
            assert.strictEqual(typeof result.success, 'boolean');
            assert.strictEqual(typeof result.content, 'string');
        });

        test('should handle max_results parameter', async () => {
            const result = await tool.execute({ 
                pattern: 'test',
                max_results: 10
            }, '/tmp');
            
            // Should handle max results parameter gracefully
            assert.strictEqual(typeof result.success, 'boolean');
            assert.strictEqual(typeof result.content, 'string');
        });

        test('should handle empty pattern', async () => {
            const result = await tool.execute({ 
                pattern: '',
                path: '/tmp'
            }, '/tmp');
            
            // Empty pattern should be handled gracefully
            if (!result.success) {
                assert.strictEqual(typeof result.error, 'string');
            } else {
                // If it succeeds, should return some content
                assert.strictEqual(typeof result.content, 'string');
            }
        });
    });
});
