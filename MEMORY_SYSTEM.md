# Memory System Documentation

The CodingAgent extension includes a sophisticated memory system that allows the AI assistant to store, retrieve, search, and manage persistent information across conversations.

## Memory Types

The system supports two types of memory:

### 1. Temporary Memory (`temporary`)
- **Storage**: In-memory (RAM only)
- **Persistence**: Lost when extension is reloaded
- **Use Case**: Short-term information for current session
- **Availability**: Always available

### 2. Project Memory (`project`) 
- **Storage**: File-based in `.codingagent/memory/` directory
- **Persistence**: Survives extension reloads and VS Code restarts
- **Use Case**: Long-term project-specific information
- **Availability**: Only when enabled in settings
- **Security**: Controlled by user permission

## Memory Tools

The system provides five tools for memory management:

### `memory_store`
Store a value in memory with a unique key.

**Parameters:**
- `key` (required): Unique identifier for the memory entry
- `value` (required): Data to store (any string, including JSON)
- `type` (required): Memory type (`temporary` or `project`)
- `metadata` (optional): Additional metadata object

**Example:**
```json
{
  "key": "user_preferences",
  "value": "{\"theme\": \"dark\", \"language\": \"typescript\"}",
  "type": "project",
  "metadata": {"category": "user_settings"}
}
```

### `memory_retrieve`
Retrieve a value from memory by key.

**Parameters:**
- `key` (required): Key of the memory entry to retrieve
- `type` (optional): Specific memory type to search in

**Behavior:**
- If `type` is specified: Searches only in that memory type
- If `type` is omitted: Searches across all available memory types

### `memory_delete`
Delete a memory entry by key.

**Parameters:**
- `key` (required): Key of the memory entry to delete
- `type` (optional): Specific memory type to delete from

**Behavior:**
- If `type` is specified: Deletes only from that memory type
- If `type` is omitted: Searches and deletes from all available memory types

### `memory_search`
Search memory entries by key or value patterns.

**Parameters:**
- `key_pattern` (optional): Pattern to search in memory keys
- `value_pattern` (optional): Pattern to search in memory values
- `type` (optional): Memory type to search in
- `case_sensitive` (optional): Case-sensitive search (default: false)
- `is_regex` (optional): Use regex patterns (default: false)
- `max_results` (optional): Maximum results to return (default: 50)

**Requirements:**
- At least one of `key_pattern` or `value_pattern` must be provided

### `memory_list`
List all memory keys.

**Parameters:**
- `type` (optional): Memory type to list keys from

**Behavior:**
- If `type` is specified: Lists keys only from that memory type
- If `type` is omitted: Lists keys from all available memory types

## Key Management

### Uniqueness Requirement
- **Global Uniqueness**: Keys must be unique across ALL memory types
- **Collision Prevention**: Storing with an existing key will fail
- **Cross-Type Search**: Retrieval and deletion can work across memory types

### Best Practices for Keys
- Use descriptive, hierarchical naming: `project_config.build_settings`
- Include context: `user_john.preferences`, `session_20250822.context`
- Avoid special characters: Use alphanumeric, dots, dashes, underscores
- Consider namespacing: `module_name.specific_data`

## Settings Configuration

### Enable Project Memory
Project memory must be explicitly enabled in settings:

1. Open CodingAgent Settings
2. Navigate to "Agent Settings" tab
3. Enable "Enable Project Memory" checkbox
4. Save settings

**Setting Key**: `codingagent.memory.enableProjectMemory`
**Default**: `false` (disabled for security)

### Security Considerations
- Project memory creates files in your workspace
- Files are stored in `.codingagent/memory/` directory
- Consider adding `.codingagent/` to `.gitignore` if needed
- Each memory entry is stored as a separate JSON file

## File Storage Details

### Project Memory Storage
- **Location**: `{workspace}/.codingagent/memory/`
- **Format**: JSON files with base64-encoded filenames
- **Structure**: Each file contains one `MemoryEntry` object
- **Encoding**: UTF-8 text files

### Memory Entry Structure
```typescript
interface MemoryEntry {
  key: string;
  value: any;
  type: MemoryType;
  timestamp: number;
  metadata?: Record<string, any>;
}
```

## Usage Examples

### Storing User Preferences
```json
{
  "key": "coding_style",
  "value": "prefer_functional_programming",
  "type": "project"
}
```

### Storing Complex Data
```json
{
  "key": "api_endpoints",
  "value": "{\"users\": \"/api/v1/users\", \"auth\": \"/api/v1/auth\"}",
  "type": "project",
  "metadata": {"version": "1.0", "last_updated": "2025-08-22"}
}
```

### Searching for API-related Information
```json
{
  "value_pattern": "api",
  "case_sensitive": false,
  "max_results": 10
}
```

## Error Handling

### Common Errors
- **Duplicate Key**: Attempting to store with existing key
- **Missing Type**: Storing without specifying memory type
- **Invalid Type**: Using unsupported memory type
- **Project Memory Disabled**: Attempting to use project memory when disabled
- **Key Not Found**: Retrieving/deleting non-existent key

### Error Messages
- Errors include descriptive messages with context
- Available memory types are listed in error messages
- Suggestions provided for common mistakes

## Future Extensions

The memory system is designed for extensibility:

### Planned Memory Types
- **Global Memory**: Shared across all projects
- **Session Memory**: Tied to specific chat sessions
- **Cached Memory**: Automatically managed with expiration

### Planned Features
- Memory encryption for sensitive data
- Memory export/import functionality
- Memory analytics and usage statistics
- Automatic memory cleanup and optimization

## Performance Considerations

### Temporary Memory
- **Fast Access**: In-memory storage for optimal performance
- **Memory Usage**: Cleared on extension reload
- **Scalability**: Limited by available RAM

### Project Memory
- **File I/O**: Slightly slower due to disk operations
- **Persistence**: Survives restarts and reloads
- **Scalability**: Limited by disk space and file system performance

### Search Performance
- **Linear Search**: Currently searches all entries
- **Optimization**: Consider indexing for large datasets
- **Limits**: Use `max_results` to prevent excessive output

## Troubleshooting

### Project Memory Not Available
1. Check if project memory is enabled in settings
2. Verify workspace has write permissions
3. Ensure `.codingagent` directory can be created

### Memory Operations Failing
1. Verify key uniqueness for store operations
2. Check memory type availability
3. Ensure required parameters are provided

### Search Not Finding Results
1. Verify search patterns and case sensitivity
2. Check if searching in correct memory type
3. Try broader search patterns

### Performance Issues
1. Limit search results with `max_results`
2. Use specific memory types instead of searching all
3. Consider cleaning up unused memory entries

## Integration with AI Assistant

The memory system is integrated into the AI assistant workflow:

### Automatic Availability
- Memory tools are automatically available when memory is enabled
- Tool descriptions reflect current memory type availability
- Error messages guide proper usage

### Context Awareness
- AI can use memory to maintain context across conversations
- Project-specific information persists between sessions
- Learning and adaptation based on stored preferences

### Tool Descriptions
- Tool descriptions dynamically update based on available memory types
- Only enabled memory types are shown to the AI
- Security through selective tool exposure
