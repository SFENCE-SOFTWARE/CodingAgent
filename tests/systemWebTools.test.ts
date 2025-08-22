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

        test('should preserve HTML structure when cleaning content', async function() {
            this.timeout(5000);
            // Test with mock HTML content
            const result = await tool.execute({ url: 'https://test-html-content.example.com' }, '/tmp');
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(typeof result.content, 'string');
            
            // HTML content should not contain script or style tags after cleaning
            assert.ok(!result.content.includes('<script'));
            assert.ok(!result.content.includes('<style'));
            assert.ok(!result.content.includes('console.log'));
            assert.ok(!result.content.includes('alert'));
            
            // Should preserve main content
            assert.ok(result.content.includes('Test Page'));
            assert.ok(result.content.includes('Main Heading'));
            assert.ok(result.content.includes('test paragraph'));
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

        test('should convert HTML to Markdown format', async function() {
            this.timeout(5000);
            // Test with mock HTML content
            const result = await tool.execute({ url: 'https://test-html-content.example.com' }, '/tmp');
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(typeof result.content, 'string');
            
            // Markdown content should not contain HTML tags
            assert.ok(!result.content.includes('<html'));
            assert.ok(!result.content.includes('<div'));
            assert.ok(!result.content.includes('<script'));
            assert.ok(!result.content.includes('<style'));
            
            // Should contain markdown formatting
            assert.ok(result.content.includes('# Main Heading'));
            assert.ok(result.content.includes('**bold text**'));
            assert.ok(result.content.includes('*italic text*'));
            assert.ok(result.content.includes('- List item 1'));
            assert.ok(result.content.includes('[Example Link](https://example.com)'));
            
            // Should not contain script content
            assert.ok(!result.content.includes('console.log'));
            assert.ok(!result.content.includes('alert'));
        });

        test('should properly truncate content with max_length', async function() {
            this.timeout(5000);
            // Test that truncation works correctly
            const result = await tool.execute({ 
                url: 'https://test-html-content.example.com',
                max_length: 50 
            }, '/tmp');
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(typeof result.content, 'string');
            
            // Content should be around max_length or slightly more due to truncation message
            assert.ok(result.content.length <= 80); // Allow margin for "... (truncated)"
            
            if (result.content.includes('(truncated)')) {
                // If truncated, the original content should have been close to max_length
                const contentWithoutTruncMsg = result.content.replace(/\n\n\.\.\. \(truncated\)$/, '');
                assert.ok(contentWithoutTruncMsg.length <= 55); // Allow small margin
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
