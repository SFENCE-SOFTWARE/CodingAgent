/**
 * Test for Mermaid architecture diagram generation from LLM JSON format
 * 
 * This test verifies that the _jsonToMermaid method correctly processes
 * LLM-generated architecture with components and connections structure
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { PlanVisualizationPanel } from '../src/planVisualizationPanel';

suite('Mermaid Architecture Generation Tests', () => {
  
  test('should generate correct Mermaid diagram from LLM components/connections structure', () => {
    // Sample LLM-generated architecture in the format mentioned by user
    const llmArchitecture = {
      "components": [
        {
          "id": "component-game-engine",
          "name": "Game Engine",
          "type": "frontend",
          "description": "Main loop orchestrating game flow, rendering, and timing."
        },
        {
          "id": "component-input-service",
          "name": "Input Service", 
          "type": "frontend",
          "description": "Handles keyboard events to move the platform."
        },
        {
          "id": "component-platform-service",
          "name": "Platform Service",
          "type": "backend",
          "description": "Manages platform position and collision detection."
        },
        {
          "id": "component-ball-service",
          "name": "Ball Service",
          "type": "backend", 
          "description": "Controls ball physics, movement, and bouncing."
        }
      ],
      "connections": [
        {
          "from": "component-game-engine",
          "to": "component-input-service",
          "type": "event",
          "description": "Game engine forwards input events to Input Service."
        },
        {
          "from": "component-game-engine",
          "to": "component-platform-service", 
          "type": "control",
          "description": "Game engine commands platform movement updates."
        },
        {
          "from": "component-game-engine",
          "to": "component-ball-service",
          "type": "control",
          "description": "Game engine updates ball physics state."
        },
        {
          "from": "component-input-service",
          "to": "component-platform-service",
          "type": "data",
          "description": "Input service sends movement commands to platform."
        }
      ]
    };

    // Create a test instance (we need to access private method)
    const panel = new (PlanVisualizationPanel as any)(
      { dispose: () => {}, webview: { html: '', onDidReceiveMessage: () => ({ dispose: () => {} }) }}, 
      { path: '' },
      'test-plan'
    );

    // Call the private _jsonToMermaid method
    const mermaidCode = (panel as any)._jsonToMermaid(llmArchitecture);

    console.log('Generated Mermaid Code:');
    console.log(mermaidCode);

    // Verify that the Mermaid code contains all components
    assert.ok(mermaidCode.includes('component-game-engine'), 'Should contain component-game-engine');
    assert.ok(mermaidCode.includes('component-input-service'), 'Should contain component-input-service'); 
    assert.ok(mermaidCode.includes('component-platform-service'), 'Should contain component-platform-service');
    assert.ok(mermaidCode.includes('component-ball-service'), 'Should contain component-ball-service');

    // Verify that component names are included
    assert.ok(mermaidCode.includes('Game Engine'), 'Should contain Game Engine name');
    assert.ok(mermaidCode.includes('Input Service'), 'Should contain Input Service name');
    assert.ok(mermaidCode.includes('Platform Service'), 'Should contain Platform Service name');
    assert.ok(mermaidCode.includes('Ball Service'), 'Should contain Ball Service name');

    // Verify that descriptions are included (truncated)
    assert.ok(mermaidCode.includes('Main loop orchestrating'), 'Should contain description fragment');
    assert.ok(mermaidCode.includes('Handles keyboard events'), 'Should contain description fragment');

    // Verify that connections are present
    assert.ok(mermaidCode.includes('component-game-engine -->'), 'Should contain connections from game engine');
    assert.ok(mermaidCode.includes('component-input-service -->'), 'Should contain connections from input service');

    // Verify that connection descriptions are included
    assert.ok(mermaidCode.includes('Game engine forwards input events'), 'Should contain connection description');
    assert.ok(mermaidCode.includes('movement commands to platform'), 'Should contain connection description');

    // Verify CSS styling classes are present
    assert.ok(mermaidCode.includes('classDef frontend'), 'Should contain frontend CSS class');
    assert.ok(mermaidCode.includes('classDef backend'), 'Should contain backend CSS class');
    assert.ok(mermaidCode.includes('classDef component'), 'Should contain component CSS class');

    // Verify that frontend and backend styling is applied
    assert.ok(mermaidCode.includes('component-game-engine:::frontend'), 'Should apply frontend styling');
    assert.ok(mermaidCode.includes('component-platform-service:::backend'), 'Should apply backend styling');

    // Verify that it doesn't fall back to the old generic structure
    assert.ok(!mermaidCode.includes('components["components"]'), 'Should not contain old generic structure');
    assert.ok(!mermaidCode.includes('connections["connections"]'), 'Should not contain old generic structure');
    assert.ok(!mermaidCode.includes('components --> connections'), 'Should not contain old generic connection');

    // Verify it starts with proper graph syntax
    assert.ok(mermaidCode.startsWith('graph TD\n'), 'Should start with proper Mermaid graph syntax');
  });

  test('should handle architecture with minimal information', () => {
    const minimalArchitecture = {
      "components": [
        {
          "id": "comp1",
          "name": "Component 1"
        },
        {
          "id": "comp2", 
          "name": "Component 2"
        }
      ],
      "connections": [
        {
          "from": "comp1",
          "to": "comp2"
        }
      ]
    };

    const panel = new (PlanVisualizationPanel as any)(
      { dispose: () => {}, webview: { html: '', onDidReceiveMessage: () => ({ dispose: () => {} }) }},
      { path: '' },
      'test-plan'
    );

    const mermaidCode = (panel as any)._jsonToMermaid(minimalArchitecture);

    assert.ok(mermaidCode.includes('comp1'), 'Should contain comp1');
    assert.ok(mermaidCode.includes('comp2'), 'Should contain comp2');
    assert.ok(mermaidCode.includes('Component 1'), 'Should contain Component 1 name');
    assert.ok(mermaidCode.includes('Component 2'), 'Should contain Component 2 name');
    assert.ok(mermaidCode.includes('comp1 --> comp2'), 'Should contain connection');
  });

  test('should handle both old nodes/edges format and new components/connections format', () => {
    const oldFormat = {
      "nodes": [
        { "id": "node1", "label": "Node 1", "type": "service" }
      ],
      "edges": [
        { "from": "node1", "to": "node2" }
      ]
    };

    const newFormat = {
      "components": [
        { "id": "comp1", "name": "Component 1", "type": "service" }
      ],
      "connections": [
        { "from": "comp1", "to": "comp2" }
      ]
    };

    const panel = new (PlanVisualizationPanel as any)(
      { dispose: () => {}, webview: { html: '', onDidReceiveMessage: () => ({ dispose: () => {} }) }},
      { path: '' },
      'test-plan'
    );

    const oldMermaid = (panel as any)._jsonToMermaid(oldFormat);
    const newMermaid = (panel as any)._jsonToMermaid(newFormat);

    // Both should generate valid Mermaid code
    assert.ok(oldMermaid.includes('node1'), 'Old format should contain node1');
    assert.ok(newMermaid.includes('comp1'), 'New format should contain comp1');
    assert.ok(oldMermaid.includes('Node 1'), 'Old format should contain Node 1 name');
    assert.ok(newMermaid.includes('Component 1'), 'New format should contain Component 1 name');
    assert.ok(oldMermaid.includes(':::service'), 'Old format should contain service styling');
    assert.ok(newMermaid.includes(':::service'), 'New format should contain service styling');
  });

  test('should escape special characters in labels and descriptions', () => {
    const architectureWithSpecialChars = {
      "components": [
        {
          "id": "special-comp",
          "name": "Component with \"quotes\" and \\n newlines",
          "description": "Description with special chars: <>&\"'"
        }
      ],
      "connections": [
        {
          "from": "special-comp",
          "to": "other-comp",
          "description": "Connection with \"quotes\" and symbols"
        }
      ]
    };

    const panel = new (PlanVisualizationPanel as any)(
      { dispose: () => {}, webview: { html: '', onDidReceiveMessage: () => ({ dispose: () => {} }) }},
      { path: '' },
      'test-plan'
    );

    const mermaidCode = (panel as any)._jsonToMermaid(architectureWithSpecialChars);

    // Should not contain unescaped quotes that would break Mermaid syntax
    assert.ok(!mermaidCode.includes('""'), 'Should not contain double quotes');
    assert.ok(mermaidCode.includes('#quot;'), 'Should use Mermaid quote escape');
    assert.ok(mermaidCode.includes('\\n'), 'Newlines should be escaped');
  });

});
