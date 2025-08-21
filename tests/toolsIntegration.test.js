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
// Import the tools service to test tool registration
const tools_1 = require("../src/tools");
suite('Tools Integration Tests', () => {
    let toolsService;
    // Use setup instead of beforeEach for VSCode test environment
    setup(() => {
        toolsService = new tools_1.ToolsService();
    });
    test('should register all expected tools', () => {
        const toolsInfo = toolsService.getAllToolsInfo();
        const expectedToolNames = [
            'read_file',
            'modify_lines',
            'write_file',
            'list_files',
            'create_folder',
            'rename_file',
            'patch_file',
            'search_pattern',
            'search_in_path',
            'get_file_size',
            'execute_terminal',
            'read_pdf',
            'read_webpage_as_html',
            'read_webpage_as_markdown'
        ];
        // Check that all expected tools are registered
        for (const expectedName of expectedToolNames) {
            const tool = toolsInfo.find(t => t.name === expectedName);
            assert.ok(tool, `Tool ${expectedName} should be registered`);
        }
        // Verify we have at least the expected number of tools
        assert.ok(toolsInfo.length >= expectedToolNames.length, `Should have at least ${expectedToolNames.length} tools, got ${toolsInfo.length}`);
    });
    test('should provide valid tool definitions for all tools', () => {
        const toolsInfo = toolsService.getAllToolsInfo();
        const definitions = toolsService.getToolDefinitions();
        for (const info of toolsInfo) {
            // Validate tool info
            assert.strictEqual(typeof info.name, 'string');
            assert.ok(info.name.length > 0, 'Tool name should not be empty');
            assert.strictEqual(typeof info.displayName, 'string');
            assert.ok(info.displayName.length > 0, 'Tool display name should not be empty');
            assert.strictEqual(typeof info.description, 'string');
            assert.ok(info.description.length > 0, 'Tool description should not be empty');
            assert.ok(['file', 'system', 'web', 'search', 'other'].includes(info.category), `Tool category ${info.category} should be valid`);
            // Validate corresponding tool definition
            const definition = definitions[info.name];
            assert.ok(definition, `Definition should exist for tool ${info.name}`);
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, info.name);
            assert.strictEqual(typeof definition.function.description, 'string');
            assert.ok(definition.function.description.length > 0, 'Tool function description should not be empty');
            // Validate parameters
            assert.strictEqual(definition.function.parameters.type, 'object');
            assert.ok(Array.isArray(definition.function.parameters.required), 'Required parameters should be an array');
            assert.strictEqual(typeof definition.function.parameters.properties, 'object');
            assert.ok(definition.function.parameters.properties !== null, 'Parameters properties should not be null');
        }
    });
    test('should have unique tool names', () => {
        const toolsInfo = toolsService.getAllToolsInfo();
        const names = toolsInfo.map(t => t.name);
        const uniqueNames = new Set(names);
        assert.strictEqual(names.length, uniqueNames.size, 'All tool names should be unique');
    });
    test('should provide tools organized by category', () => {
        const toolsByCategory = toolsService.getToolsByCategory();
        const categories = Object.keys(toolsByCategory);
        // Should have multiple categories
        assert.ok(categories.length > 1, 'Should have multiple tool categories');
        // Check that we have expected categories
        assert.ok(categories.includes('file'), 'Should have file category tools');
        assert.ok(categories.includes('system') || categories.includes('search'), 'Should have system or search category tools');
        // Each category should have tools
        for (const category of categories) {
            assert.ok(toolsByCategory[category].length > 0, `Category ${category} should have at least one tool`);
        }
    });
    test('should be able to execute tool functions', async () => {
        const toolsInfo = toolsService.getAllToolsInfo();
        for (const info of toolsInfo) {
            // Skip execute_terminal in tests as it requires user approval
            if (info.name === 'execute_terminal') {
                continue;
            }
            // Test that executeTool can find and attempt to execute each tool
            try {
                // Use minimal valid arguments for each tool type
                let args = {};
                if (info.name === 'read_file' || info.name === 'write_file' ||
                    info.name === 'list_files' || info.name === 'create_folder' ||
                    info.name === 'rename_file' || info.name === 'get_file_size') {
                    args.path = 'test';
                    if (info.name === 'write_file') {
                        args.content = 'test';
                    }
                    if (info.name === 'rename_file') {
                        args.old_path = 'test';
                        args.new_path = 'test2';
                    }
                }
                else if (info.name === 'patch_file') {
                    args = { path: 'test', old_text: 'old', new_text: 'new' };
                }
                else if (info.name === 'modify_lines') {
                    args = { path: 'test', operation: 'insert', line_number: 1, content: 'test' };
                }
                else if (info.name === 'search_pattern') {
                    args = { pattern: 'test' }; // SearchPatternTool doesn't need path
                }
                else if (info.name === 'search_in_path') {
                    args = { pattern: 'test', path: '/tmp' };
                }
                else if (info.name === 'read_pdf') {
                    args.path = 'test.pdf';
                }
                else if (info.name === 'read_webpage_as_html') {
                    args.url = 'https://example.com';
                }
                else if (info.name === 'read_webpage_as_markdown') {
                    args.url = 'https://example.com';
                }
                const result = await toolsService.executeTool(info.name, args);
                // Should return a valid ToolResult
                assert.strictEqual(typeof result.success, 'boolean');
                assert.strictEqual(typeof result.content, 'string');
                if (!result.success) {
                    assert.strictEqual(typeof result.error, 'string');
                }
            }
            catch (error) {
                // Some tools might throw errors with invalid arguments, that's okay
                assert.ok(error instanceof Error, `Tool ${info.name} should throw proper Error objects`);
            }
        }
    });
    test('should handle unknown tool names gracefully', async () => {
        const result = await toolsService.executeTool('unknown_tool_name', {});
        // Should return error result
        assert.strictEqual(result.success, false);
        assert.strictEqual(typeof result.error, 'string');
        assert.ok(result.error.includes('Unknown tool'), 'Error should mention unknown tool');
    });
    test('should validate tool existence', () => {
        // Test hasTool method
        assert.ok(toolsService.hasTool('read_file'), 'Should have read_file tool');
        assert.ok(toolsService.hasTool('write_file'), 'Should have write_file tool');
        assert.ok(!toolsService.hasTool('nonexistent_tool'), 'Should not have nonexistent tool');
    });
    test('should get tool definitions for specific tools', () => {
        const specificToolNames = ['read_file', 'write_file'];
        const definitions = toolsService.getToolDefinitions(specificToolNames);
        assert.strictEqual(Object.keys(definitions).length, 2);
        assert.ok(definitions['read_file'], 'Should have read_file definition');
        assert.ok(definitions['write_file'], 'Should have write_file definition');
        assert.ok(!definitions['list_files'], 'Should not have list_files definition');
    });
    test('should handle errors in tool execution gracefully', async () => {
        // Test with a tool that might fail (missing required params)
        const result = await toolsService.executeTool('read_file', {});
        // Should handle missing parameters gracefully
        assert.strictEqual(typeof result.success, 'boolean');
        assert.strictEqual(typeof result.content, 'string');
        if (!result.success) {
            assert.strictEqual(typeof result.error, 'string');
        }
    });
    test('should provide consistent tool information structure', () => {
        const toolsInfo = toolsService.getAllToolsInfo();
        for (const info of toolsInfo) {
            // Check that each tool info has all required properties
            assert.ok('name' in info, 'ToolInfo should have name property');
            assert.ok('displayName' in info, 'ToolInfo should have displayName property');
            assert.ok('description' in info, 'ToolInfo should have description property');
            assert.ok('category' in info, 'ToolInfo should have category property');
            // Check property types
            assert.strictEqual(typeof info.name, 'string');
            assert.strictEqual(typeof info.displayName, 'string');
            assert.strictEqual(typeof info.description, 'string');
            assert.strictEqual(typeof info.category, 'string');
        }
    });
});
//# sourceMappingURL=toolsIntegration.test.js.map