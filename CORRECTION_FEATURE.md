# Send Correction Feature Implementation

## Přehled

Implementoval jsem funkcionalitu **Send Correction** tlačítka, které umožňuje uživateli zasáhnout do tool call procesu s korekcí nebo dodatečnými instrukcemi.

## Klíčová funkcionalita

**Send Correction ovlivňuje pouze tool cally**, stejně jako Interrupt LLM. Umožňuje uživateli:
- Zaslat korekci během tool call procesu
- Pozastavit tool call execution během zadávání korekce
- Aplikovat korekci na aktuální nebo následující tool call

## Implementované změny

### 1. ChatService (`src/chatService.ts`)

**Nová pole:**
- `private pendingCorrection: string | null = null` - uchování napsané korekce
- `private isWaitingForCorrection: boolean = false` - čekání na uživatelskou akci

**Nové metody:**
- `requestCorrection()` - spustí požadavek na korekci
- `submitCorrection(correctionText)` - odešle korekci
- `cancelCorrection()` - zruší korekci

**Tool call logika:**
```typescript
// Wait for correction if one is pending
if (this.isWaitingForCorrection) {
  while (this.isWaitingForCorrection) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Apply correction if available
if (this.pendingCorrection) {
  const correctionMessage: OpenAIChatMessage = {
    role: 'tool',
    tool_call_id: toolCall.id,
    name: toolCall.function.name,
    content: `Error: User correction: ${this.pendingCorrection}`
  };
  // Skip normal tool execution
}
```

### 2. UI komponenty

**Nové tlačítko:**
```html
<button id="correctionButton" class="correction-button" title="Send Correction">
  <span class="codicon codicon-edit"></span>
</button>
```

**Correction dialog:**
- Modal dialog s textarea pro zadání korekce
- Cancel a Submit tlačítka
- Ctrl+Enter pro rychlé odeslání

### 3. Styly (`media/chat.css`)

**Correction tlačítko:**
- Standardní VS Code button styly
- Zobrazuje se vedle Interrupt tlačítka
- Ikona editace

**Correction dialog:**
- Modal overlay s poloprůhledným pozadím
- VS Code tema barvy
- Responzivní design
- Focus management

### 4. JavaScript funkcionalita (`media/chat.js`)

**Nové funkce:**
- `requestCorrection()` - zobrazí dialog
- `submitCorrection()` - odešle korekci
- `cancelCorrection()` - zruší akci

**Event handling:**
- Dialog se zobrazí na `correctionRequest` událost
- Keyboard shortcuts (Ctrl+Enter)
- Automatické zaměření na textarea

## Workflow scénáře

### Scénář 1: Korekce během tool call

1. **Tool cally začnou** → Zobrazí se Interrupt a Correction tlačítka
2. **Uživatel klikne Correction** → Otevře se dialog
3. **Během psaní korekce přijde tool call** → Agent pozastaví execution
4. **Uživatel odešle korekci** → Korekce se aplikuje jako error message
5. **Model dostane feedback** → Může reagovat na korekci

### Scénář 2: Korekce před tool call

1. **Tool cally začnou** → Zobrazí se tlačítka
2. **Uživatel klikne Correction** → Otevře se dialog
3. **Uživatel napíše a odešle korekci** → Korekce se uloží
4. **Příští tool call** → Dostane korekci místo normálního execution
5. **Model reaguje** → Na základě korekce

### Scénář 3: Zrušení korekce

1. **Uživatel klikne Correction** → Otevře se dialog
2. **Uživatel klikne Cancel** → Dialog se zavře, pokračuje normálně
3. **Žádný vliv** → Tool cally pokračují bez změny

## Technické detaily

### Čekání na uživatelskou akci
```typescript
while (this.isWaitingForCorrection) {
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

### Aplikace korekce jako tool error
```typescript
const correctionMessage: OpenAIChatMessage = {
  role: 'tool',
  tool_call_id: toolCall.id,
  name: toolCall.function.name,
  content: `Error: User correction: ${this.pendingCorrection}`
};
```

### UI synchronizace
- Dialog se zobrazí automaticky při `correction_request` událostí
- Tlačítko je viditelné pouze během tool callů
- Focus management pro lepší UX

## Bezpečnost a stabilita

- **Žádné přerušování HTTP requestů** - stejně jako u Interrupt
- **Čekání na uživatele** - tool cally se pozastaví elegantně
- **Jednorázová korekce** - každá korekce se použije pouze jednou
- **Graceful handling** - zrušení nepoškodí stav aplikace

## Příklady použití

### Korekce chybného příkazu
```
User: "Read the file config.json"
AI: [calls read_file with wrong path]
User: [clicks Correction] "Use config/app.json instead"
AI: Receives error with correction and tries again
```

### Dodatečné instrukce
```
User: "Modify the function"
AI: [calls modify_file]
User: [clicks Correction] "Add error handling and use async/await"
AI: Gets feedback and modifies approach
```

### Zabránění nežádoucí akce
```
User: "Delete old files"
AI: [calls delete_file]
User: [clicks Correction] "Don't delete anything, just list the files first"
AI: Changes approach based on correction
```

## Výhody

1. **Interaktivní control** - uživatel může zasáhnout v real-time
2. **Flexibilní timing** - korekce funguje před i během tool callů
3. **Non-destructive** - korekce nepřeruší celý proces
4. **Educative** - AI se učí z uživatelského feedbacku
5. **Intuitive UX** - jednoduchý dialog, jasné tlačítka

Tato funkcionalita významně zlepšuje interakci s AI během automatizovaných úloh a poskytuje uživateli kontrolu nad procesem bez nutnosti přerušit celou konverzaci.
