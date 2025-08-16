import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import file-related tools
import { ReadFileTool } from '../tools/readFile';
import { WriteFileTool } from '../tools/writeFile';
import { ListFilesTool } from '../tools/listFiles';
import { CreateFolderTool } from '../tools/createFolder';
import { RenameFileTool } from '../tools/renameFile';
import { PatchFileTool } from '../tools/patchFile';
import { GetFileSizeTool } from '../tools/getFileSize';

suite('File Tools Integration Tests', () => {
    let tempDir: string;
    let workspaceRoot: string;

    setup(async () => {
        // Create temporary workspace for testing
        try {
            tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codingagent-test-'));
            workspaceRoot = tempDir;
            
            // Create test directory structure
            await fs.promises.mkdir(path.join(tempDir, 'testDir'), { recursive: true });
            await fs.promises.mkdir(path.join(tempDir, 'subDir'), { recursive: true });
            
            // Create test files
            await fs.promises.writeFile(
                path.join(tempDir, 'testFile.txt'), 
                'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
            );
            await fs.promises.writeFile(
                path.join(tempDir, 'testDir', 'nested.txt'), 
                'Nested file content'
            );
            await fs.promises.writeFile(
                path.join(tempDir, 'searchTest.ts'), 
                'function hello() {\n  console.log("Hello World");\n}\nconst x = 42;'
            );
        } catch (error) {
            console.warn('Failed to setup test environment:', error);
            // Skip tests if can't create temp directory
            tempDir = '';
            workspaceRoot = '/tmp';
        }
    });

    teardown(async () => {
        // Clean up temporary directory
        if (tempDir && fs.existsSync(tempDir)) {
            try {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            } catch (error) {
                console.warn('Failed to cleanup test directory:', error);
            }
        }
    });

    suite('ReadFileTool Integration', () => {
        let tool: ReadFileTool;

        setup(() => {
            tool = new ReadFileTool();
        });

        test('should read entire file when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ path: 'testFile.txt' }, workspaceRoot);
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.content, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
        });

        test('should read file with line range when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ 
                path: 'testFile.txt', 
                start_line: 2, 
                end_line: 4 
            }, workspaceRoot);
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.content, 'Line 2\nLine 3\nLine 4');
        });

        test('should read file with byte limit when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ 
                path: 'testFile.txt', 
                max_bytes: 10 
            }, workspaceRoot);
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.content.length, 10);
        });

        test('should handle absolute paths when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const absolutePath = path.join(workspaceRoot, 'testFile.txt');
            const result = await tool.execute({ path: absolutePath }, workspaceRoot);
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.content, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
        });
    });

    suite('WriteFileTool Integration', () => {
        let tool: WriteFileTool;

        setup(() => {
            tool = new WriteFileTool();
        });

        test('should write new file when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const testContent = 'This is test content';
            const result = await tool.execute({ 
                path: 'newFile.txt', 
                content: testContent 
            }, workspaceRoot);
            
            assert.strictEqual(result.success, true);
            
            // Verify file was created
            const filePath = path.join(workspaceRoot, 'newFile.txt');
            assert.ok(fs.existsSync(filePath));
            const actualContent = await fs.promises.readFile(filePath, 'utf8');
            assert.strictEqual(actualContent, testContent);
        });

        test('should overwrite existing file when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const newContent = 'Overwritten content';
            const result = await tool.execute({ 
                path: 'testFile.txt', 
                content: newContent 
            }, workspaceRoot);
            
            assert.strictEqual(result.success, true);
            
            const filePath = path.join(workspaceRoot, 'testFile.txt');
            const actualContent = await fs.promises.readFile(filePath, 'utf8');
            assert.strictEqual(actualContent, newContent);
        });

        test('should append to existing file when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const appendContent = '\nAppended line';
            const result = await tool.execute({ 
                path: 'testFile.txt', 
                content: appendContent,
                append: true
            }, workspaceRoot);
            
            assert.strictEqual(result.success, true);
            
            const filePath = path.join(workspaceRoot, 'testFile.txt');
            const actualContent = await fs.promises.readFile(filePath, 'utf8');
            assert.ok(actualContent.includes('Appended line'));
        });

        test('should create directory if not exists when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ 
                path: 'newDir/subdir/file.txt', 
                content: 'content' 
            }, workspaceRoot);
            
            assert.strictEqual(result.success, true);
            
            const filePath = path.join(workspaceRoot, 'newDir', 'subdir', 'file.txt');
            assert.ok(fs.existsSync(filePath));
        });
    });

    suite('ListFilesTool Integration', () => {
        let tool: ListFilesTool;

        setup(() => {
            tool = new ListFilesTool();
        });

        test('should list files in directory when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ path: '.' }, workspaceRoot);
            assert.strictEqual(result.success, true);
            
            const files = result.content.split('\n');
            assert.ok(files.some(f => f.includes('testFile.txt')));
            assert.ok(files.some(f => f.includes('testDir/')));
        });

        test('should list files recursively when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ path: '.', recursive: true }, workspaceRoot);
            assert.strictEqual(result.success, true);
            
            const files = result.content.split('\n');
            assert.ok(files.some(f => f.includes('testDir/nested.txt')));
        });

        test('should handle file instead of directory', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ path: 'testFile.txt' }, workspaceRoot);
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Path is not a directory'));
        });
    });

    suite('CreateFolderTool Integration', () => {
        let tool: CreateFolderTool;

        setup(() => {
            tool = new CreateFolderTool();
        });

        test('should create single folder when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ path: 'newFolder' }, workspaceRoot);
            assert.strictEqual(result.success, true);
            
            const folderPath = path.join(workspaceRoot, 'newFolder');
            assert.ok(fs.existsSync(folderPath));
            assert.ok(fs.statSync(folderPath).isDirectory());
        });

        test('should create nested folders recursively when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ 
                path: 'deep/nested/folder', 
                recursive: true 
            }, workspaceRoot);
            assert.strictEqual(result.success, true);
            
            const folderPath = path.join(workspaceRoot, 'deep', 'nested', 'folder');
            assert.ok(fs.existsSync(folderPath));
            assert.ok(fs.statSync(folderPath).isDirectory());
        });

        test('should handle existing folder when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ path: 'testDir' }, workspaceRoot);
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('already exists'));
        });
    });

    suite('RenameFileTool Integration', () => {
        let tool: RenameFileTool;

        setup(() => {
            tool = new RenameFileTool();
        });

        test('should rename file when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            // Create a test file first
            const testFile = path.join(workspaceRoot, 'toRename.txt');
            await fs.promises.writeFile(testFile, 'content');
            
            const result = await tool.execute({ 
                old_path: 'toRename.txt', 
                new_path: 'renamed.txt' 
            }, workspaceRoot);
            
            assert.strictEqual(result.success, true);
            assert.ok(!fs.existsSync(testFile));
            assert.ok(fs.existsSync(path.join(workspaceRoot, 'renamed.txt')));
        });

        test('should move file to different directory when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            // Create a test file first
            const testFile = path.join(workspaceRoot, 'toMove.txt');
            await fs.promises.writeFile(testFile, 'content');
            
            const result = await tool.execute({ 
                old_path: 'toMove.txt', 
                new_path: 'testDir/moved.txt' 
            }, workspaceRoot);
            
            assert.strictEqual(result.success, true);
            assert.ok(!fs.existsSync(testFile));
            assert.ok(fs.existsSync(path.join(workspaceRoot, 'testDir', 'moved.txt')));
        });
    });

    suite('PatchFileTool Integration', () => {
        let tool: PatchFileTool;

        setup(() => {
            tool = new PatchFileTool();
        });

        test('should patch file content when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            // Setup test file
            const testContent = 'Hello World\nThis is a test\nGoodbye';
            await fs.promises.writeFile(path.join(workspaceRoot, 'patchTest.txt'), testContent);
            
            const result = await tool.execute({ 
                path: 'patchTest.txt',
                old_text: 'This is a test',
                new_text: 'This is modified'
            }, workspaceRoot);
            
            assert.strictEqual(result.success, true);
            
            const updatedContent = await fs.promises.readFile(
                path.join(workspaceRoot, 'patchTest.txt'), 'utf8'
            );
            assert.ok(updatedContent.includes('This is modified'));
            assert.ok(!updatedContent.includes('This is a test'));
        });

        test('should handle non-existent old text when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ 
                path: 'testFile.txt',
                old_text: 'Non-existent text',
                new_text: 'New text'
            }, workspaceRoot);
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Text not found'), 
                `Expected error to include 'Text not found', got: ${result.error}`);
        });
    });

    suite('GetFileSizeTool Integration', () => {
        let tool: GetFileSizeTool;

        setup(() => {
            tool = new GetFileSizeTool();
        });

        test('should get file size when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ path: 'searchTest.ts' }, workspaceRoot);
            assert.strictEqual(result.success, true);
            assert.ok(result.content.includes('bytes'));
            // Extract the size from the formatted output
            const sizeMatch = result.content.match(/Size: (\d+) bytes/);
            assert.ok(sizeMatch, 'Should contain size in the expected format');
            const size = parseInt(sizeMatch![1]);
            assert.ok(size > 0, 'File size should be greater than 0');
        });

        test('should handle directory when temp dir available', async () => {
            if (!tempDir) {
                console.log('Skipping test - no temp directory available');
                return;
            }
            
            const result = await tool.execute({ path: 'testDir' }, workspaceRoot);
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Path is not a file'));
        });
    });
});
