import * as assert from 'assert';

// Import system and web tools
import { ExecuteTerminalTool } from '../src/tools/executeTerminal';
import { ReadPdfTool } from '../src/tools/readPdf';
import { ReadWebpageAsHTMLTool } from '../src/tools/readWebpageAsHTML';
import { ReadWebpageAsMarkdownTool } from '../src/tools/readWebpageAsMarkdown';
import { SearchInProjectTool } from '../src/tools/searchInProject';

// Mock HTML content for testing
const MOCK_HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
    <style>body { font-family: Arial; }</style>
    <script>console.log('test');</script>
</head>
<body>
    <h1>Main Heading</h1>
    <p>This is a test paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
    <ul>
        <li>List item 1</li>
        <li>List item 2</li>
    </ul>
    <a href="https://example.com">Example Link</a>
    <script>alert('should be removed');</script>
</body>
</html>
`;

// Mock fetch for testing
const originalFetch = global.fetch;

function mockFetch(url: string): Promise<Response> {
    // Mock successful response for test URLs
    if (url.includes('test-html-content') || url.includes('httpbin.org/html')) {
        return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: () => Promise.resolve(MOCK_HTML_CONTENT),
            headers: new Headers({ 'content-type': 'text/html' })
        } as Response);
    }
    
    // Mock error responses for invalid URLs
    if (url === 'invalid-url' || url === 'not-a-url-at-all') {
        return Promise.reject(new TypeError('Failed to fetch'));
    }
    
    // Mock 404 for non-existent domains
    if (url.includes('this-domain-definitely-does-not-exist')) {
        return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: () => Promise.resolve(''),
            headers: new Headers()
        } as Response);
    }
    
    // Fallback to original fetch for any other URLs
    return originalFetch(url);
}

suite('System and Web Tools Tests', () => {
    // Setup and teardown for fetch mocking
    setup(() => {
        global.fetch = mockFetch as any;
    });

    teardown(() => {
        global.fetch = originalFetch;
    });

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

        test('should handle invalid URL gracefully', async function() {
            const result = await tool.execute({ url: 'invalid-url' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
            assert.ok(result.error!.length > 0);
        });

        test('should handle malformed URL gracefully', async function() {
            const result = await tool.execute({ url: 'not-a-url-at-all' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });

        test('should handle non-existent domain gracefully', async function() {
            const result = await tool.execute({ 
                url: 'https://this-domain-definitely-does-not-exist-12345.com' 
            }, '/tmp');
            
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });

        test('should handle max_length parameter', async function() {
            // Use an invalid URL but test that the parameter is accepted
            const result = await tool.execute({ 
                url: 'invalid-url',
                max_length: 100 
            }, '/tmp');
            
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });

        test('should require memory service for storage', async function() {
            this.timeout(5000);
            // Test that memory_key is required
            const definition = tool.getToolDefinition();
            assert.ok(definition.function.parameters.required.includes('memory_key'));
            
            // Test with tool that has no memory service (should fail)
            const result = await tool.execute({ 
                url: 'https://test-html-content.example.com',
                memory_key: 'test_html_page'
            }, '/tmp');
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Memory service not available'));
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

        test('should handle invalid URL gracefully', async function() {
            const result = await tool.execute({ url: 'invalid-url' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
            assert.ok(result.error!.length > 0);
        });

        test('should handle malformed URL gracefully', async function() {
            const result = await tool.execute({ url: 'not-a-url-at-all' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });

        test('should handle non-existent domain gracefully', async function() {
            const result = await tool.execute({ 
                url: 'https://this-domain-definitely-does-not-exist-12345.com' 
            }, '/tmp');
            
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });

        test('should handle max_length parameter', async function() {
            // Use an invalid URL but test that the parameter is accepted
            const result = await tool.execute({ 
                url: 'invalid-url',
                max_length: 200 
            }, '/tmp');
            
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });

        test('should require memory service for Markdown conversion', async function() {
            this.timeout(5000);
            // Test with tool that has no memory service (should fail)
            const result = await tool.execute({ 
                url: 'https://test-html-content.example.com',
                memory_key: 'test_markdown_page'
            }, '/tmp');
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Memory service not available'));
        });

        test('should require memory_key parameter', async function() {
            this.timeout(5000);
            // Test that max_length parameter is accepted
            const definition = tool.getToolDefinition();
            assert.ok(definition.function.parameters.required.includes('memory_key'));
        });

        test('should require memory_key parameter', async function() {
            const definition = tool.getToolDefinition();
            
            // memory_key should now be required
            assert.ok(definition.function.parameters.required.includes('memory_key'));
            assert.ok(definition.function.parameters.required.includes('url'));
        });

        test('should handle memory storage when memory service not available', async function() {
            // Test with tool that has no memory service
            const toolWithoutMemory = new ReadWebpageAsMarkdownTool();
            const result = await toolWithoutMemory.execute({ 
                url: 'https://test-html-content.example.com',
                memory_key: 'test_key'
            }, '/tmp');
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Memory service not available'));
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

    suite('SearchInProjectTool', () => {
        let tool: SearchInProjectTool;

        setup(() => {
            tool = new SearchInProjectTool();
        });

        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'search_in_project');
            assert.strictEqual(info.displayName, 'Search in Project');
            assert.strictEqual(info.category, 'search');
            assert.strictEqual(typeof info.description, 'string');
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'search_in_project');
            assert.ok(definition.function.parameters.required.includes('pattern'));
        });
    });
});
