/**
 * Example of improved Mermaid diagram generation from LLM architecture
 * 
 * This demonstrates how the updated _jsonToMermaid method should process
 * LLM-generated architecture in components/connections format
 */

// Input: LLM-generated architecture (as mentioned by user)
const INPUT_ARCHITECTURE = {
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

// Expected Output: Meaningful Mermaid diagram showing actual architecture
const EXPECTED_MERMAID_OUTPUT = `graph TD
    component-game-engine["Game Engine\\nMain loop orchestrating game flow, rendering, and timing."]
    component-game-engine:::frontend
    component-input-service["Input Service\\nHandles keyboard events to move the platform."]
    component-input-service:::frontend
    component-platform-service[["Platform Service\\nManages platform position and collision detection."]]
    component-platform-service:::backend
    component-ball-service[["Ball Service\\nControls ball physics, movement, and bouncing."]]
    component-ball-service:::backend

    component-game-engine -->|"Game engine forwards input events to Input Service."| component-input-service
    component-game-engine -->|"Game engine commands platform movement updates."| component-platform-service
    component-game-engine -->|"Game engine updates ball physics state."| component-ball-service
    component-input-service -->|"Input service sends movement commands to platform."| component-platform-service

    classDef database fill:#e1f5fe,stroke:#0277bd,stroke-width:2px,color:#000
    classDef service fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000
    classDef component fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef frontend fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#000
    classDef backend fill:#fff8e1,stroke:#f57c00,stroke-width:2px,color:#000
    classDef decision fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#000`;

// OLD PROBLEMATIC OUTPUT: Generic diagram that's the same for every architecture
const OLD_PROBLEMATIC_OUTPUT = `graph TD
    components["components"]
    connections["connections"]
    components --> connections`;

/**
 * IMPROVEMENTS MADE:
 * 
 * 1. ✅ Support for LLM format: Now handles both 'nodes/edges' and 'components/connections' formats
 * 2. ✅ Real component visualization: Shows actual component names and descriptions, not just generic structure
 * 3. ✅ Component type styling: Different visual styles for frontend/backend/service/database components
 * 4. ✅ Connection descriptions: Shows meaningful connection labels with descriptions
 * 5. ✅ Shape differentiation: Different shapes for different component types (rectangles, rounded, etc.)
 * 6. ✅ Label escaping: Proper handling of special characters in names and descriptions
 * 7. ✅ Length limiting: Truncates very long descriptions to keep diagram readable
 * 
 * BEFORE: Every architecture generated the same useless "components --> connections" diagram
 * AFTER: Each architecture generates a unique, meaningful diagram showing the actual system structure
 */

export { INPUT_ARCHITECTURE, EXPECTED_MERMAID_OUTPUT, OLD_PROBLEMATIC_OUTPUT };
