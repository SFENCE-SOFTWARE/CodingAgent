# Interrupt LLM Feature Implementation

## Přehled

Implementoval jsem funkcionalitet **Interrupt LLM** tlačítka, které umožňuje uživateli přerušit komunikaci s AI modelem **pouze během tool call smyčky**, tedy na stejném místě kde dříve vznikala chyba "Tool call process stopped after 10 iterations to prevent infinite loops."

## Klíčová změna v designu

**Přerušení neprobíhá během normální odpovědi modelu**, ale pouze když model provádí tool cally. To znamená:

- ✅ **Bezpečné**: Normální odpovědi modelu nelze přerušit (nejsou nebezpečné)
- ✅ **Účinné**: Tool cally lze přerušit (zde může dojít k nekonečné smyčce nebo nežádoucím změnám)  
- ✅ **Intuitivní**: Tlačítko se zobrazuje pouze když je potřeba

## Implementované změny

### 1. ChatService (`src/chatService.ts`)

**Nová pole a metody:**
- `private isInterrupted: boolean = false` - flag pro sledování stavu přerušení
- `interruptLLM()` - veřejná metoda pro přerušení LLM
- `resetInterrupt()` - reset stavu při novém zpracování zprávy

**Klíčové změny:**
- **Pouze jedna kontrola přerušení**: Na začátku každé iterace tool call smyčky
- **Signalizace start/end**: Nové eventi `tool_calls_start` a `tool_calls_end`
- **Notice typ zprávy**: Místo `error` se používá `notice` pro lepší UX
- **Odstranění HTTP abort**: Žádné přerušování na úrovni HTTP requestů

### 2. Types (`src/types.ts`)

**Rozšířené typy:**
- `ChatMessage.role` - přidán typ `'notice'`
- `StreamingUpdate.type` - přidány typy `'tool_calls_start'` a `'tool_calls_end'`

### 3. UI State Management

**Nové stavy ve frontend:**
- `isToolCallsRunning` - specificky pro sledování tool callů
- `isInterruptPending` - sledování pending stavu interrupt
- Odděleno od `isLoading` pro obecné loading

### 4. CSS Styly (`media/chat.css`)

**Nové styly pro notice zprávy:**
```css
.message.notice .message-content {
  background-color: var(--vscode-inputValidation-infoBackground);
  border: 1px solid var(--vscode-inputValidation-infoBorder);
  color: var(--vscode-inputValidation-infoForeground);
}
```

### 5. JavaScript Frontend (`media/chat.js`)

**Nová funkcionalita:**
- Pending stav tlačítka s spinning ikonou
- Odstranění okamžité zprávy při kliknutí
- Obsluha `toolCallsStart` / `toolCallsEnd` událostí
- Avatar ikona ℹ️ pro notice typ

## Chování funkce

### Kdy je tlačítko viditelné
- **Viditelné**: Pouze během tool call smyčky
- **Skryté**: Během normální odpovědi modelu, při čekání na input, atd.

### Stavy tlačítka
- **Normální stav**: Červené tlačítko s ikonou "stop" - `Interrupt LLM`
- **Pending stav**: Spinning ikona - `Interrupt pending...` (disabled)

### Co se stane při přerušení

1. **Kliknutí na tlačítko**:
   - Tlačítko přejde do pending stavu (spinning ikona)
   - Odešle se interrupt request do backend
   - **ŽÁDNÁ zpráva se nezobrazí**

2. **Skutečné přerušení** (při další iteraci tool call smyčky):
   - Zobrazí se zpráva typu `notice`: `"Notice: Interrupted at user request."`
   - Tool call smyčka se ukončí
   - Tlačítko se skryje
   - UI se vrátí do normálního stavu

3. **Bezpečnost**:
   - Žádné přerušování HTTP requestů
   - Žádné přerušování během streaming odpovědi
   - Model dokončí svou aktuální odpověď

### Typy zpráv

**Starý timeout (zůstává stejný):**
```
Tool call process stopped after 10 iterations to prevent infinite loops.
```
- Typ: `error` (červené pozadí)

**Nové přerušení:**
```
Notice: Interrupted at user request.
```
- Typ: `notice` (modré info pozadí)
- Ikona: ℹ️

### UI Design

**Pending stav tlačítka:**
- Spinning loading ikona
- Disabled stav
- Tooltip: "Interrupt pending..."
- Nedovoluje více požadavků

**Notice zprávy:**
- Modré info pozadí (místo červeného error)
- Info ikona ℹ️ místo warning ⚠️
- Používá VS Code info barvy

## Případy použití

### ✅ Kdy tlačítko pomůže:
- Model volá tooly v nekonečné smyčce
- Model provádí nežádoucí změny souborů
- Tool call trvá příliš dlouho
- Uživatel si uvědomil chybu v zadání

### ❌ Kdy tlačítko nebude viditelné:
- Model generuje normální odpověď (i dlouhou)
- Model "přemýšlí" (reasoning/thinking)
- Čekání na input od uživatele
- Loading modelů/konfigurací

## Výhody tohoto přístupu

1. **Bezpečnost**: Normální odpovědi modelu jsou neškodné a není důvod je přerušovat
2. **Účinnost**: Přerušení tam kde může dojít k problémům (tool cally)
3. **Jednoduchost**: Žádné složité HTTP abort mechanismy
4. **Stabilita**: Není riziko cascade chyb nebo poškození stavu aplikace
5. **UX**: Tlačítko se objevuje pouze když je potřeba

## Testování

Pro otestování:

1. Spusťte konverzaci která vyvolá tool cally (např. "read a file and modify it")
2. Během tool call smyčky se objeví červené tlačítko "Interrupt LLM"  
3. Klikněte na tlačítko
4. Měla by se zobrazit zpráva o přerušení a tool cally se zastaví

**Poznámka**: Během normální odpovědi modelu (bez tool callů) se tlačítko nezobrazí.
