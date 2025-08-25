# Ask User Tool - Implementace

## Přehled

Nový tool `ask_user` umožňuje LLM požádat o zpětnou vazbu od uživatele když má nejistotu a potřebuje clarifikaci před pokračováním.

## Funkce

### 1. Tool Definition
- **Název:** `ask_user`
- **Kategorie:** `system`
- **Popis:** Dynamicky se aktualizuje na základě nastavené úrovně nejistoty

### 2. Parametry
- `question` (povinný): Otázka pro uživatele
- `context` (volitelný): Dodatečný kontext
- `urgency` (volitelný): "low", "medium", "high" - ovlivňuje vzhled UI

### 3. GUI Komponenty

#### Dialog pro dotaz uživatele
- **Překrývá input container** (podobně jako correction dialog)
- Zobrazuje otázku, kontext (pokud je zadán), textové pole pro odpověď
- Tlačítka: "Answer" a "Cancel"
- Podporuje Ctrl+Enter pro rychlé odeslání
- Urgency styling pro různé typy dotazů

#### Nastavení v Settings panelu
- **Ask User Uncertainty Threshold (%)**: 0-100%, default 70%
- Nachází se v "Behavior" tabu
- Dynamicky aktualizuje popis tool v LLM

### 4. Konfigurace

#### Package.json
```json
"codingagent.askUser.uncertaintyThreshold": {
  "type": "number",
  "default": 70,
  "minimum": 0,
  "maximum": 100,
  "description": "Uncertainty percentage threshold - AI will ask for user feedback when uncertainty is above this level"
}
```

#### Mode Configuration
Tool je defaultně povolen v "Architect" modu:
- Pro architekturu je důležité získat správné požadavky
- Lze přidat do dalších módů dle potřeby

### 5. Workflow

1. LLM volá `ask_user` tool s otázkou
2. Tool zobrazí dialog uživateli (překryje input area)
3. Uživatel buď odpoví nebo zruší (Cancel)
4. **Cancel** = skutečný interrupt - zastaví veškeré zpracování a čeká na nový prompt
5. **Answer** = LLM dostane odpověď a může pokračovat

### 6. Interrupt Behavior (Okamžité přerušení)

#### Cancel tlačítko:
- **Okamžité nastavení interrupt flag** - nepočká na dokončení tool call
- **Kontrola interrupt flag** na múltiple místech:
  - Na začátku každého tool call loop iteration
  - Před každým jednotlivým tool call
  - Po dokončení každého tool call
- Zastaví veškeré tool call processing
- Zruší loading/tool calls running stavy
- **Neposílá žádnou odpověď LLM** - prostě čeká na nový user prompt

#### Technické řešení:
```typescript
// V askUser tool - okamžité nastavení interrupt
static resolveRequest(requestId: string, answer?: string, cancelled: boolean = false) {
  if (cancelled && AskUserTool.interruptHandler) {
    AskUserTool.interruptHandler(); // Ihned nastav interrupt flag
  }
  resolver({ answer, cancelled });
}

// V chatService - kontrola interrupt na více místech
while (normalizedToolCalls.length > 0) {
  if (this.isInterrupted) return results; // Check na začátku loop
  
  for (const toolCall of normalizedToolCalls) {
    if (this.isInterrupted) return results; // Check před každým tool call
    
    const toolResult = await this.tools.executeTool(...);
    
    if (this.isInterrupted) return results; // Check po každém tool call
  }
}
```

### 7. Technické detaily

#### Async Communication
- Používá Promise-based řešení s Map pro pending requests
- Timeout 5 minut pro automatické zrušení
- Static handler pro komunikaci mezi tool a UI

#### UI Components
- **Nový overlay dialog** překrývá input container
- Event handlers v chat.js
- Message routing přes chatViewProvider.ts
- Streaming update type v types.ts

#### Styling
- Podobný correction dialog stylu
- Urgency classes pro různé typy dotazů
- Responsive design
- VS Code theme support

### 8. Použití v LLM

```typescript
// Příklad volání
{
  "name": "ask_user",
  "arguments": {
    "question": "Should I use REST API or GraphQL for this project?",
    "context": "The project is a small e-commerce app with about 10 entities",
    "urgency": "medium"
  }
}
```

### 9. Bezpečnost

- Timeout pro zamezení nekonečného čekání
- **True interrupt capability** - Cancel skutečně zastaví vše
- Validace parametrů
- Error handling pro všechny edge cases

## Testování

Tool lze testovat nastavením Architect modu a požádáním o architektonické rozhodnutí, kde LLM bude nejistý.

### Test Cancel Behavior:
1. Aktivuj ask_user tool
2. Klikni Cancel
3. Ověř, že se nezobrazí žádná další LLM odpověď
4. UI je připraveno na nový user prompt

### Test Answer Behavior:
1. Aktivuj ask_user tool  
2. Zadej odpověď a klikni Answer
3. LLM pokračuje s danou odpovědí
