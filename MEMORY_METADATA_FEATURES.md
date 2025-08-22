# Rozšířené Memory Tools s Metadaty

## Přehled změn

Memory tools byly rozšířeny o pokročilá metadata a možnosti vyhledávání pro lepší práci s LLM. Nyní podporují:

### Nová metadata pole

- **dataType**: Automatická detekce typu dat (`text`, `json`, `code`, `config`, `url`, `file_path`, `number`, `boolean`, `list`, `object`, `api_key`, `credentials`, `other`)
- **category**: Kategorizace pro organizaci (např. `user_preferences`, `project_config`, `api_endpoints`)
- **tags**: Flexibilní tagy pro vyhledávání (např. `['frontend', 'api', 'important']`)
- **priority**: Úroveň důležitosti (`low`, `medium`, `high`, `critical`)
- **description**: Lidsky čitelný popis dat
- **context**: Kontext, kde se data používají
- **expiresAfterDays**: Automatické vypršení po X dnech
- **relatedKeys**: Odkazy na související memory záznamy
- **accessCount**: Počet přístupů k záznamu
- **lastAccessed**: Čas posledního přístupu
- **sizeBytes**: Přibližná velikost v bytech
- **complexity**: Úroveň složitosti (`simple`, `medium`, `complex`)

### Rozšířené vyhledávání

- Filtrování podle datového typu, kategorie, tagů, priority
- Vyhledávání v metadatech
- Datumové filtry (od/do)
- Pokročilé řazení podle relevance, přístupů, priority
- Kombinace více kritérií

## Příklady použití

### 1. Ukládání s metadaty

```json
{
  "key": "openai_api_key",
  "value": "sk-abc123def456...",
  "type": "temporary",
  "dataType": "api_key",
  "category": "credentials",
  "tags": ["openai", "api", "secret"],
  "priority": "critical",
  "description": "OpenAI API key for GPT model access",
  "context": "Used for AI chat functionality",
  "expiresAfterDays": 30
}
```

### 2. Vyhledávání podle typu dat

```json
{
  "data_type": "api_key"
}
```

### 3. Vyhledávání podle tagů

```json
{
  "tags": ["api", "important"]
}
```

### 4. Kombinované vyhledávání s řazením

```json
{
  "data_type": "code",
  "tags": ["javascript"],
  "priority": "high",
  "sort_by": "relevance",
  "sort_order": "desc"
}
```

### 5. Automatická detekce typů

Memory service automaticky detekuje:
- **URL**: `https://...` → `url`
- **JSON**: `{"key": "value"}` → `json`
- **Code**: obsahuje `function`, `class`, `import` → `code`
- **File paths**: obsahuje `/` bez mezer → `file_path`
- **Numbers**: číselné hodnoty → `number`
- **Booleans**: true/false → `boolean`
- **Arrays**: `[...]` → `list`
- **Objects**: `{...}` → `object`

## Výhody pro LLM

1. **Lepší kontextuální vyhledávání**: LLM může najít relevantní data podle obsahu a účelu
2. **Organizovaná struktura**: Kategorie a tagy umožňují logické seskupování
3. **Prioritizace**: Kritická data jsou zvýrazněna
4. **Sledování použití**: Často používaná data jsou snáze dostupná
5. **Automatické expirování**: Neaktuální data se automaticky vyčistí
6. **Metadata search**: Možnost vyhledávat i v popisech a kontextu

## Tool API rozšíření

### memory_store
Přidané parametry:
- `dataType`, `category`, `tags`, `priority`
- `description`, `context`, `expiresAfterDays`
- `relatedKeys`

### memory_search
Nové filtry:
- `data_type`, `category`, `tags`, `priority`
- `from_date`, `to_date`, `metadata_pattern`
- `sort_by`, `sort_order`

### memory_list
Nové možnosti:
- `show_details`: Zobrazí metadata
- Kompaktní přehled s typy a tagy

### memory_retrieve
Rozšířený výstup:
- Všechna dostupná metadata
- Statistiky přístupů
- Informace o expiraci

## Technické detaily

- **Zpětná kompatibilita**: Stávající memory záznamy fungují bez změn
- **Performance**: Metadata jsou optimalizována pro rychlé vyhledávání
- **Validace**: Automatická kontrola duplicitních klíčů napříč memory types
- **Persistence**: Project memory uchovává všechna metadata mezi restarty

## Příklady LLM využití

LLM nyní může efektivněji:
- Najít API klíče: `search by data_type: api_key`
- Hledat code snippets: `search by data_type: code, tags: [javascript]`
- Prioritizovat kritická data: `search by priority: critical`
- Organizovat podle kategorií: `search by category: project_config`
- Sledovat často používaná data: `sort by accessCount`
