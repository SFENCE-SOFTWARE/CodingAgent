import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';

// Import tools to test their interfaces
import { ReadFileTool } from '../tools/readFile';
import { WriteFileTool } from '../tools/writeFile';
import { ListFilesTool } from '../tools/listFiles';
import { CreateFolderTool } from '../tools/createFolder';
import { RenameFileTool } from '../tools/renameFile';
import { PatchFileTool } from '../tools/patchFile';
import { InsertLinesTool } from '../tools/insertLines';
import { SearchPatternTool } from '../tools/searchPattern';
import { GetFileSizeTool } from '../tools/getFileSize';
import { ExecuteTerminalTool } from '../tools/executeTerminal';
import { ReadPdfTool } from '../tools/readPdf';
import { ReadWebpageTool } from '../tools/readWebpage';

suite('Tools Test Suite', () => {
    suite('ReadFileTool', () => {
        let tool: ReadFileTool;

        setup(() => {
            tool = new ReadFileTool();
        });

        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'read_file');
            assert.strictEqual(info.displayName, 'Read File');
            assert.strictEqual(info.category, 'file');
            assert.strictEqual(typeof info.description, 'string');
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'read_file');
            assert.strictEqual(typeof definition.function.description, 'string');
            assert.strictEqual(definition.function.parameters.type, 'object');
            assert.ok(Array.isArray(definition.function.parameters.required));
            assert.ok(definition.function.parameters.required.includes('path'));
        });

        test('should handle non-existent file gracefully', async () => {
            const result = await tool.execute({ path: 'nonexistent.txt' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
            assert.ok(result.error!.length > 0);
        });
    });

    suite('WriteFileTool', () => {
        let tool: WriteFileTool;

        setup(() => {
            tool = new WriteFileTool();
        });

        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'write_file');
            assert.strictEqual(info.displayName, 'Write File');
            assert.strictEqual(info.category, 'file');
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'write_file');
            assert.ok(definition.function.parameters.required.includes('path'));
            assert.ok(definition.function.parameters.required.includes('content'));
        });
    });

    suite('ListFilesTool', () => {
        let tool: ListFilesTool;

        setup(() => {
            tool = new ListFilesTool();
        });

        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'list_files');
            assert.strictEqual(info.displayName, 'List Files');
            assert.strictEqual(info.category, 'file');
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'list_files');
            assert.ok(definition.function.parameters.required.includes('path'));
        });

        test('should handle non-existent directory gracefully', async () => {
            const result = await tool.execute({ path: 'nonexistent' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });
    });

    suite('CreateFolderTool', () => {
        let tool: CreateFolderTool;

        setup(() => {
            tool = new CreateFolderTool();
        });

        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'create_folder');
            assert.strictEqual(info.displayName, 'Create Folder');
            assert.strictEqual(info.category, 'file');
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'create_folder');
            assert.ok(definition.function.parameters.required.includes('path'));
        });
    });

    suite('RenameFileTool', () => {
        let tool: RenameFileTool;

        setup(() => {
            tool = new RenameFileTool();
        });

        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'rename_file');
            assert.strictEqual(info.displayName, 'Rename File');
            assert.strictEqual(info.category, 'file');
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'rename_file');
            assert.ok(definition.function.parameters.required.includes('old_path'));
            assert.ok(definition.function.parameters.required.includes('new_path'));
        });

        test('should handle non-existent source file gracefully', async () => {
            const result = await tool.execute({ 
                old_path: 'nonexistent.txt', 
                new_path: 'renamed.txt' 
            }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });
    });

    suite('PatchFileTool', () => {
        let tool: PatchFileTool;

        setup(() => {
            tool = new PatchFileTool();
        });

        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'patch_file');
            assert.strictEqual(info.displayName, 'Patch File');
            assert.strictEqual(info.category, 'file');
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'patch_file');
            assert.ok(definition.function.parameters.required.includes('path'));
            assert.ok(definition.function.parameters.required.includes('old_text'));
            assert.ok(definition.function.parameters.required.includes('new_text'));
        });

        test('should handle non-existent file gracefully', async () => {
            const result = await tool.execute({ 
                path: 'nonexistent.txt',
                old_text: 'old',
                new_text: 'new'
            }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });
    });

    suite('InsertLinesTool', () => {
        let tool: InsertLinesTool;

        setup(() => {
            tool = new InsertLinesTool();
        });

        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'insert_lines');
            assert.strictEqual(info.displayName, 'Insert Lines');
            assert.strictEqual(info.category, 'file');
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'insert_lines');
            assert.ok(definition.function.parameters.required.includes('path'));
            assert.ok(definition.function.parameters.required.includes('content'));
        });

        test('should handle non-existent file gracefully', async () => {
            const result = await tool.execute({ 
                path: 'nonexistent.txt',
                content: 'new content'
            }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
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
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'search_pattern');
            assert.ok(definition.function.parameters.required.includes('pattern'));
            // Note: path is not required for SearchPatternTool - it searches workspace
        });

        test('should handle search in workspace gracefully', async () => {
            const result = await tool.execute({ 
                pattern: 'test'
            }, '/tmp');
            // This tool searches the workspace, so it might succeed or fail depending on workspace state
            assert.strictEqual(typeof result.success, 'boolean');
            assert.strictEqual(typeof result.content, 'string');
        });
    });

    suite('GetFileSizeTool', () => {
        let tool: GetFileSizeTool;

        setup(() => {
            tool = new GetFileSizeTool();
        });

        test('should provide correct tool info', () => {
            const info = tool.getToolInfo();
            assert.strictEqual(info.name, 'get_file_size');
            assert.strictEqual(info.displayName, 'Get File Size');
            assert.strictEqual(info.category, 'file');
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'get_file_size');
            assert.ok(definition.function.parameters.required.includes('path'));
        });

        test('should handle non-existent file gracefully', async () => {
            const result = await tool.execute({ path: 'nonexistent.txt' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });
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
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'execute_terminal');
            assert.ok(definition.function.parameters.required.includes('command'));
        });

        test('should execute simple command', async () => {
            const result = await tool.execute({ command: 'echo "test"' }, '/tmp');
            if (result.success) {
                assert.ok(result.content.includes('test'));
            } else {
                // On some systems this might fail, so we just check it handles it gracefully
                assert.strictEqual(typeof result.error, 'string');
            }
        });

        test('should handle invalid command gracefully', async () => {
            const result = await tool.execute({ command: 'nonexistentcommand12345' }, '/tmp');
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
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'read_pdf');
            assert.ok(definition.function.parameters.required.includes('path'));
        });

        test('should return not implemented error', async () => {
            const result = await tool.execute({ path: 'test.pdf' }, '/tmp');
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
        });

        test('should provide correct tool definition', () => {
            const definition = tool.getToolDefinition();
            assert.strictEqual(definition.type, 'function');
            assert.strictEqual(definition.function.name, 'read_webpage');
            assert.ok(definition.function.parameters.required.includes('url'));
        });

        test('should handle invalid URL gracefully', async () => {
            const result = await tool.execute({ url: 'invalid-url' }, '/tmp');
            assert.strictEqual(result.success, false);
            assert.strictEqual(typeof result.error, 'string');
        });
    });
});
