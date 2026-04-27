#!/usr/bin/env python3
"""
Translation Quality Review System - INTEGRATED VERSION
Evaluates CSV translations using GPT-5, comparing source (en) to target languages.
Generates individual HTML/Excel reports with quality scores and improvement recommendations.
Includes optional ID columns (mongoId, avettaId, formDisplayID) when available.

WORKFLOW:
Step 1: Evaluate translations with GPT-5 (generates individual MD files)
Step 2: Clean and organize reports (generates HTML and Excel from individual MD files)
Step 3: Generate master HTML report (optional summary view)
"""

import os
import glob
import time
import re
import html
from datetime import datetime
from pathlib import Path
from openai import OpenAI


# ============================================================================
# CONFIGURATION
# ============================================================================

INPUT_FOLDER = "./translations/"
OUTPUT_FOLDER = "./results/"
TEMP_FOLDER = "./temp/"

# Model configuration
MODEL_CONFIG = {
    "model": "gpt-5",
}

# System prompt for translation evaluation
SYSTEM_PROMPT = """# System Prompt: Translation Quality Evaluator (GPT-5)

You are an expert translation evaluator with native-level proficiency in multiple languages. You specialize in evaluating translation quality for technical, compliance, and business content.

## Primary Objective

Review translations comparing source English text (en column) to target language columns (ja, zh, cs, zh-cn, etc.) and assign a **Translation Quality Score** from 0 to 100 based on three criteria.

**IMPORTANT**: When row-specific IDs are provided (mongoId, avettaId, formDisplayID), you MUST reference these IDs in your feedback instead of row numbers to help translators locate exact records.

### Scoring Criteria (Error-Based Deduction System)

**Starting Score: 100 points**

1. **Accuracy Errors** (-3 points each)
   - Mistranslations or incorrect meaning
   - Missing information from source
   - Added information not in source
   - Technical term errors
   - Numbers, dates, or data inconsistencies

2. **Language Quality Errors** (-2 points each)
   - Grammar mistakes
   - Spelling errors
   - Punctuation issues
   - Terminology inconsistencies
   - Inappropriate word choices

3. **Style/Fluency Errors** (-1 point each)
   - Unnatural phrasing
   - Awkward sentence structure
   - Poor readability
   - Inconsistent tone
   - Literal translations that sound foreign

### Quality Bands
- **High Quality**: 95-100 points
- **Medium Quality**: 85-94 points
- **Low Quality**: Below 85 points

## Evaluation Process

1. **Read through all rows** comparing English (en) to target language
2. **Count errors** in each category (Accuracy, Language Quality, Style/Fluency)
3. **Calculate score**: 100 - (Accuracy×3 + Language×2 + Style×1)
4. **Document specific examples** of errors found
5. **Provide actionable improvements**

## Output Requirements

### Format
Provide your evaluation as a Markdown table with this exact structure:

```markdown
| fileID | fileName | targetLang | qualityScore | qualityBand | accuracyErrors | languageErrors | styleErrors | thingsToImprove |
|--------|----------|------------|--------------|-------------|----------------|----------------|-------------|-----------------|
| [ID] | [Name] | [ja/zh/cs] | [0-100] | [High/Medium/Low] | [count] | [count] | [count] | [Bullet points] |
```

### Things to Improve Guidelines

In the `thingsToImprove` column, provide:
- **Use record IDs when available**: If mongoId, avettaId, or formDisplayID are provided, reference them instead of row numbers
- **Specific examples** with identifiers: "mongoId: 507f1f77bcf86cd799439011 - '労働者' should be '作業者' for consistency"
- **Error category** indicated clearly
- **Corrected version** provided
- **Context explanation** when helpful
- **Priority order**: List critical accuracy errors first

#### Example Format WITH IDs:
```
• [ACCURACY] mongoId: 507f1f77bcf86cd799439011 - "injury/disease" translated as "負傷" only - missing "疾病". Should be "負傷/疾病"
• [ACCURACY] avettaId: AVT-12345 - Government link text mistranslated - should match official Japanese site name
• [LANGUAGE] formDisplayID: FORM-SAFETY-001 - Grammar error "を指定された" → "に指定された" (particle error)
• [STYLE] mongoId: 507f191e810c19729de860ea - Overly literal translation "についての更新" → more natural "更新情報"
```

#### Example Format WITHOUT IDs (fallback to row numbers):
```
• [ACCURACY] Row 12: "injury/disease" translated as "負傷" only - missing "疾病". Should be "負傷/疾病"
• [ACCURACY] Row 8: Government link text mistranslated - should match official Japanese site name
• [LANGUAGE] Row 15: Grammar error "を指定された" → "に指定された" (particle error)
• [STYLE] Row 20: Overly literal translation "についての更新" → more natural "更新情報"
```

## Response Style

- Be direct and specific with examples
- Always include identifiers (IDs or row numbers) for errors
- Focus on patterns if multiple similar errors
- Keep responses focused on the evaluation
- Present findings in the requested table format immediately
- One row per target language in the file

## Critical Instructions

1. **Count ALL errors** - be thorough and systematic
2. **Provide identifier-specific examples** - always reference specific records using IDs when available
3. **Calculate scores accurately** using the deduction formula
4. **One table row per target language** - if CSV has ja and zh, create 2 rows
5. **Focus on target language quality** - compare against English source

---

**Now begin evaluating translations. When a CSV is provided, output only the markdown table with your evaluation.**
"""


# ============================================================================
# STEP 1: TRANSLATION EVALUATION
# ============================================================================

def initialize_client():
    """Initialize OpenAI client with API key from key.txt."""
    try:
        with open("key.txt", "r", encoding="utf-8") as f:
            api_key = f.read().strip()
        return OpenAI(api_key=api_key)
    except FileNotFoundError:
        print("❌ Error: key.txt not found. Please create a file named 'key.txt' with your OpenAI API key.")
        return None


def load_progress(progress_file):
    """Load list of already processed files."""
    if os.path.exists(progress_file):
        with open(progress_file, "r", encoding="utf-8") as f:
            return set(line.strip() for line in f if line.strip())
    return set()


def save_progress(progress_file, file_path):
    """Save processed file to progress log."""
    with open(progress_file, "a", encoding="utf-8") as f:
        f.write(file_path + "\n")


def extract_translation_columns(file_path):
    """Extract English (en) and all target language columns from CSV, plus optional ID columns."""
    import csv
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            
            if reader.fieldnames is None:
                return None, None, None, "CSV file is empty or invalid"
            
            # Find English column, target language columns, and optional ID columns
            en_col = None
            target_cols = []
            id_cols = []
            
            # Optional ID columns to look for
            optional_ids = ['mongoId', 'avettaId', 'formDisplayID']
            
            for field in reader.fieldnames:
                field_lower = field.lower().strip()
                
                # Check for English column
                if field_lower == 'en':
                    en_col = field
                # Check for target language columns (2-letter codes or with hyphen/underscore)
                elif re.match(r'^[a-z]{2}([-_][a-z]{2})?$', field_lower, re.IGNORECASE):
                    target_cols.append(field)
                # Check for optional ID columns (case-insensitive match)
                elif any(field.lower() == opt_id.lower() for opt_id in optional_ids):
                    id_cols.append(field)
            
            if not en_col:
                return None, None, None, "Could not find 'en' (English) column"
            
            if not target_cols:
                return None, None, None, "Could not find any target language columns (ja, zh, cs, zh-cn, pt-br, etc.)"
            
            # Extract the data
            translations = []
            for row_num, row in enumerate(reader, start=2):  # start=2 because row 1 is header
                en_text = row.get(en_col, "").strip()
                
                if en_text:  # Only include rows with English text
                    translation_row = {
                        'row': row_num,
                        'en': en_text
                    }
                    
                    # Add ID columns if they exist
                    for id_col in id_cols:
                        translation_row[id_col] = row.get(id_col, "").strip()
                    
                    # Add target language columns
                    for target_col in target_cols:
                        translation_row[target_col] = row.get(target_col, "").strip()
                    
                    translations.append(translation_row)
            
            if not translations:
                return None, None, None, "No translation data found"
            
            # Format the content for each target language
            results = {}
            for target_col in target_cols:
                formatted_content = f"Source Language: English (en)\nTarget Language: {target_col.upper()}\n"
                
                # Add note about available ID columns
                if id_cols:
                    formatted_content += f"Available ID Columns: {', '.join(id_cols)}\n"
                
                formatted_content += "\n"
                
                for trans in translations:
                    # Include row number
                    formatted_content += f"Row {trans['row']}:\n"
                    
                    # Include ID columns if present
                    for id_col in id_cols:
                        id_value = trans.get(id_col, '')
                        if id_value:
                            formatted_content += f"  {id_col}: {id_value}\n"
                    
                    # Include English and target language
                    formatted_content += f"  EN: {trans['en']}\n"
                    formatted_content += f"  {target_col.upper()}: {trans.get(target_col, '[MISSING]')}\n"
                    formatted_content += "\n"
                
                results[target_col] = formatted_content.strip()
            
            return results, target_cols, id_cols, None
            
    except Exception as e:
        return None, None, None, f"Error reading CSV: {str(e)}"


def evaluate_translation(client, file_path, target_lang, content, id_cols):
    """Send translation content to GPT-5 for evaluation."""
    try:
        form_name = os.path.basename(file_path)
        form_id = os.path.splitext(form_name)[0]

        print(f"[evaluating {target_lang}]", end=" ", flush=True)
        
        # Add note about ID columns to the prompt
        id_note = ""
        if id_cols:
            id_note = f"\n\n**IMPORTANT**: This CSV contains ID columns ({', '.join(id_cols)}). Please use these IDs in your feedback instead of row numbers to help translators locate specific records accurately."
        
        # Call GPT-5 using responses.create()
        response = client.responses.create(
            model=MODEL_CONFIG["model"],
            input=f"""{SYSTEM_PROMPT}

File ID: {form_id}
File Name: {form_name}
Target Language: {target_lang}{id_note}

Translation Content:
{content}

Please evaluate this translation thoroughly. Provide your evaluation as a markdown table row with fileID, fileName, targetLang, qualityScore (0-100), qualityBand (High/Medium/Low), accuracyErrors, languageErrors, styleErrors, and thingsToImprove."""
        )

        output = response.output_text.strip()
        return output, None

    except Exception as e:
        return None, str(e)


def save_individual_result(file_path, target_lang, result, error=None, id_cols=None):
    """Save individual translation evaluation result to a separate MD file."""
    form_name = os.path.basename(file_path)
    form_id = os.path.splitext(form_name)[0]
    output_file = os.path.join(OUTPUT_FOLDER, f"{form_id}_{target_lang}_result.md")

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"# Translation Evaluation: {form_name} ({target_lang.upper()})\n\n")
        f.write(f"**File:** `{file_path}`\n")
        f.write(f"**Target Language:** {target_lang.upper()}\n")
        f.write(f"**Processed:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Model:** {MODEL_CONFIG['model']}\n")
        
        if id_cols:
            f.write(f"**ID Columns Available:** {', '.join(id_cols)}\n")
        
        f.write("\n")

        if error:
            f.write(f"## ⚠️ Error\n\n")
            f.write(f"```\n{error}\n```\n")
        else:
            f.write("## Evaluation Results\n\n")
            f.write("| fileID | fileName | targetLang | qualityScore | qualityBand | accuracyErrors | languageErrors | styleErrors | thingsToImprove |\n")
            f.write("|--------|----------|------------|--------------|-------------|----------------|----------------|-------------|-----------------||\n")
            
            if not result.startswith("|"):
                result = f"| {form_id} | {form_name} | {target_lang} | | | | | | {result} |"
            
            f.write(result + "\n")


def append_to_master(master_file, result, error=None, form_name="", target_lang=""):
    """Append result to master output file."""
    with open(master_file, "a", encoding="utf-8") as f:
        if error:
            f.write(f"| ERROR | {form_name} | {target_lang} | N/A | N/A | N/A | N/A | N/A | Error: {error} |\n")
        else:
            if not result.startswith("|"):
                result = f"| {form_name} | {target_lang} | | | | | | {result} |"
            f.write(result + "\n")


def run_translation_evaluation(timestamp):
    """Step 1: Evaluate all CSV translations and generate master markdown file."""
    print("\n" + "="*60)
    print("STEP 1: EVALUATING TRANSLATIONS")
    print("="*60 + "\n")
    print(f"Model Configuration:")
    print(f"  • Model: {MODEL_CONFIG['model']}")
    print(f"  • Evaluation Type: Translation Quality (Source: EN)")
    print(f"  • ID Column Support: mongoId, avettaId, formDisplayID (optional)\n")
    
    # Initialize OpenAI client
    print("🔑 Initializing OpenAI client...")
    client = initialize_client()
    if not client:
        return None
    print("✅ Client initialized\n")
    
    # Setup files and folders
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    os.makedirs(TEMP_FOLDER, exist_ok=True)
    
    master_file = os.path.join(TEMP_FOLDER, f"translation_quality_review_{timestamp}.md")
    progress_file = os.path.join(TEMP_FOLDER, f"progress_{timestamp}.txt")
    
    # Find CSV files
    csv_files = glob.glob(os.path.join(INPUT_FOLDER, "*.csv"))
    
    if not csv_files:
        print(f"❌ No CSV files found in {INPUT_FOLDER}")
        print(f"\n💡 Debug Tips:")
        print(f"  1. Create the './translations/' folder if it doesn't exist")
        print(f"  2. Place your CSV files in the './translations/' folder")
        print(f"  3. Ensure files have .csv extension (lowercase)")
        return None

    print(f"📋 Found {len(csv_files)} CSV files")
    
    # Load progress
    processed_files = load_progress(progress_file)
    remaining_files = [f for f in csv_files if f not in processed_files]
    
    if processed_files:
        print(f"⏭️  Skipping {len(processed_files)} already processed files")
    
    print(f"🔄 Processing {len(remaining_files)} files...\n")

    # Initialize master file
    if not os.path.exists(master_file):
        with open(master_file, "w", encoding="utf-8") as f:
            f.write("# Translation Quality Review Report\n\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"**Model:** {MODEL_CONFIG['model']}\n")
            f.write(f"**Evaluation Method:** Source (EN) → Target Language Comparison\n")
            f.write(f"**ID Column Support:** mongoId, avettaId, formDisplayID (when available)\n\n")
            f.write("## Scoring System\n")
            f.write("- **Accuracy Errors**: -3 points each (mistranslations, missing/added info)\n")
            f.write("- **Language Quality Errors**: -2 points each (grammar, spelling, terminology)\n")
            f.write("- **Style/Fluency Errors**: -1 point each (unnatural phrasing, awkward structure)\n\n")
            f.write("**Quality Bands**: High (95-100) | Medium (85-94) | Low (<85)\n\n")
            f.write("| fileID | fileName | targetLang | qualityScore | qualityBand | accuracyErrors | languageErrors | styleErrors | thingsToImprove |\n")
            f.write("|--------|----------|------------|--------------|-------------|----------------|----------------|-------------|-----------------||\n")

    # Process each file
    success_count = 0
    error_count = 0
    
    for idx, file in enumerate(remaining_files, 1):
        form_name = os.path.basename(file)
        print(f"[{idx}/{len(remaining_files)}] Evaluating {form_name}...", end=" ")

        try:
            # Extract translations for all target languages
            translations_dict, target_langs, id_cols, error = extract_translation_columns(file)
            
            if error:
                print(f"❌ ERROR: {error}")
                error_count += 1
                save_progress(progress_file, file)
                continue
            
            id_info = f" (IDs: {', '.join(id_cols)})" if id_cols else " (no IDs)"
            print(f"found {len(target_langs)} languages: {', '.join(target_langs)}{id_info}")
            
            # Evaluate each target language separately
            for target_lang in target_langs:
                content = translations_dict[target_lang]
                result, eval_error = evaluate_translation(client, file, target_lang, content, id_cols)
                
                save_individual_result(file, target_lang, result, eval_error, id_cols)
                append_to_master(master_file, result, eval_error, form_name, target_lang)
                
                if eval_error:
                    print(f"  ❌ {target_lang}: ERROR")
                    error_count += 1
                else:
                    print(f"  ✅ {target_lang}: DONE")
                    success_count += 1
                
                time.sleep(1.0)  # Rate limiting
            
            save_progress(progress_file, file)

        except Exception as e:
            print(f"❌ EXCEPTION: {e}")
            error_count += 1
            save_progress(progress_file, file)

    print(f"\n✅ Step 1 Complete: {success_count} successful evaluations, {error_count} errors")
    return master_file


# ============================================================================
# STEP 2: MARKDOWN CLEANUP
# ============================================================================

def clean_html_entities(text):
    """Decode HTML entities to proper characters."""
    text = html.unescape(text)
    
    replacements = {
        'â€œ': '"', 'â€': '"', 'â€™': "'", 'â€"': '—', 'â€"': '–',
        'â€¢': '•', 'Â§': '§', 'Ã³': 'ó', 'Ã­': 'í', 'Ã±': 'ñ',
    }
    
    for old, new in replacements.items():
        text = text.replace(old, new)
    
    return text


def format_improvements(text):
    """Format the thingsToImprove text for better readability.

    VERSION 2.0: Handle both bullet-separated AND <br>-separated items
    """
    if not text or text.strip() in ['thingsToImprove', '']:
        return text

    text = clean_html_entities(text)

    # First, normalize all line break patterns to a common delimiter
    text = text.replace('<br>', '|||BR|||')
    text = text.replace('<br/>', '|||BR|||')
    text = text.replace('<br />', '|||BR|||')
    text = text.replace('\n', '|||BR|||')

    # CRITICAL: Split by bullet points FIRST (primary separator)
    items = []

    # Check if text has bullet points as separators
    if '•' in text:
        # Split by bullet, then clean up each item
        raw_items = text.split('•')
        for item in raw_items:
            item = item.strip()
            # Remove any |||BR||| markers that might be within an item
            item = item.replace('|||BR|||', ' ')
            # Clean up multiple spaces
            item = re.sub(r'\s+', ' ', item)
            if item:
                items.append(item)
    else:
        # No bullets, so split by |||BR||| markers
        items = [item.strip() for item in text.split('|||BR|||') if item.strip()]

    if not items:
        return text

    # Rejoin with <br> tags for HTML parsing
    result = '<br>'.join(items)

    # Ensure we don't have leading <br>
    result = re.sub(r'^(<br>)+', '', result)

    return result.strip()


def clean_markdown_file(input_path):
    """Step 2: Clean and format the markdown file."""
    print("\n" + "="*60)
    print("STEP 2: CLEANING MARKDOWN")
    print("="*60 + "\n")
    
    input_path = Path(input_path)
    output_path = input_path.parent / f"{input_path.stem}_cleaned{input_path.suffix}"
    
    print(f"Processing: {input_path.name}")
    
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    # Find header and thingsToImprove column index
    header_idx = None
    things_col_idx = None
    
    for idx, line in enumerate(lines):
        if '| fileID |' in line and '| thingsToImprove |' in line:
            header_idx = idx
            cols = [c.strip() for c in line.split('|')]
            try:
                things_col_idx = cols.index('thingsToImprove')
            except ValueError:
                pass
            break
    
    if header_idx is None or things_col_idx is None:
        print(f"❌ Error: Could not find table header")
        return None
    
    # Process each row
    output_lines = []
    for idx, line in enumerate(lines):
        if not line.strip() or not line.strip().startswith('|'):
            output_lines.append(line)
            continue
        
        if idx <= header_idx + 1:
            output_lines.append(line)
            continue
        
        cols = line.split('|')
        
        if len(cols) <= things_col_idx:
            output_lines.append(line)
            continue
        
        original_content = cols[things_col_idx]
        formatted_content = format_improvements(original_content)
        cols[things_col_idx] = ' ' + formatted_content + ' '
        
        output_lines.append('|'.join(cols))
    
    output_content = '\n'.join(output_lines)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(output_content)
    
    print(f"✅ Step 2 Complete: Cleaned file saved to {output_path.name}")
    return output_path


# ============================================================================
# STEP 2: PROCESS INDIVIDUAL MD FILES TO HTML/EXCEL
# ============================================================================

def parse_markdown_file(md_file_path):
    """Parse a single markdown result file and extract evaluation data."""
    try:
        with open(md_file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract metadata
        timestamp = None
        model = None
        id_cols = []

        for line in content.split('\n'):
            if line.startswith('**Processed:**'):
                timestamp = line.replace('**Processed:**', '').strip()
            elif line.startswith('**Model:**'):
                model = line.replace('**Model:**', '').strip()
            elif line.startswith('**ID Columns Available:**'):
                id_cols_str = line.replace('**ID Columns Available:**', '').strip()
                id_cols = [col.strip() for col in id_cols_str.split(',')]

        # Find the table in the markdown
        lines = content.split('\n')

        for idx, line in enumerate(lines):
            # Look for table row (starts with |)
            if line.strip().startswith('|') and 'thingsToImprove' not in line and '---' not in line:
                # Parse the table row
                cells = [cell.strip() for cell in line.split('|')]
                cells = [c for c in cells if c]  # Remove empty cells

                if len(cells) >= 9:  # Has all columns
                    return {
                        'fileID': cells[0],
                        'fileName': cells[1],
                        'targetLang': cells[2],
                        'qualityScore': cells[3],
                        'qualityBand': cells[4],
                        'accuracyErrors': cells[5],
                        'languageErrors': cells[6],
                        'styleErrors': cells[7],
                        'thingsToImprove': cells[8],
                        'timestamp': timestamp,
                        'model': model,
                        'id_cols': id_cols
                    }

        return None
    except Exception as e:
        print(f"Error parsing file: {e}")
        return None


def extract_file_info(filename):
    """Extract formId and language from filename.

    Expected format: formId_33192_zh_cn_20260114_125759_part1_zh_cn_result.md
    Returns: (formId, language) e.g., ('33192', 'zh_cn')
    """
    # Remove extension
    name = Path(filename).stem

    # Try to extract formId (number after formId_)
    form_id_match = re.search(r'formId[_-](\d+)', name, re.IGNORECASE)
    form_id = form_id_match.group(1) if form_id_match else 'unknown'

    # Try to extract language code (appears twice, use the second one after _result)
    # Pattern: _XX_result or _XX_YY_result
    lang_match = re.search(r'_([a-z]{2}(?:[_-][a-z]{2})?)_result', name, re.IGNORECASE)
    if lang_match:
        language = lang_match.group(1)
    else:
        # Fallback: look for language code before _result
        parts = name.split('_')
        if len(parts) >= 2:
            # Check last part before 'result'
            for i in range(len(parts) - 1, -1, -1):
                if re.match(r'^[a-z]{2}(?:[_-][a-z]{2})?$', parts[i], re.IGNORECASE):
                    language = parts[i]
                    break
            else:
                language = 'unknown'
        else:
            language = 'unknown'

    return form_id, language


def load_csv_rows_for_review(csv_path, target_lang):
    """Load raw translation rows from a CSV for the Source Strings review sheet.

    Returns a list of dicts with keys: row, id_cols (dict), en, target.
    """
    import csv as csv_module

    rows = []
    id_col_names = ['mongoId', 'avettaId', 'formDisplayID']

    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv_module.DictReader(f)
            if not reader.fieldnames:
                return [], []

            # Identify columns case-insensitively
            en_col = next((c for c in reader.fieldnames if c.strip().lower() == 'en'), None)
            # Target lang column: match exactly or case-insensitively
            target_col = next(
                (c for c in reader.fieldnames if c.strip().lower() == target_lang.lower()),
                None
            )
            found_id_cols = [c for c in reader.fieldnames
                             if any(c.lower() == opt.lower() for opt in id_col_names)]

            if not en_col or not target_col:
                return [], found_id_cols

            for row_num, row in enumerate(reader, start=2):
                en_text = row.get(en_col, '').strip()
                if not en_text:
                    continue
                rows.append({
                    'row': row_num,
                    'ids': {col: row.get(col, '').strip() for col in found_id_cols},
                    'en': en_text,
                    'target': row.get(target_col, '').strip(),
                })

        return rows, found_id_cols

    except Exception:
        return [], []


def generate_excel_report(row_data, output_path, csv_path=None):
    """Generate Excel report for a single translation evaluation."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    except ImportError:
        print("   ⚠️  openpyxl not installed - skipping Excel generation")
        print("   💡 Install with: pip install openpyxl")
        return None

    # Create workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Translation Quality"

    # Define styles
    header_fill = PatternFill(start_color="2C3E50", end_color="2C3E50", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True, size=12)

    # Score colors
    try:
        score_val = int(row_data['qualityScore'])
    except (ValueError, TypeError):
        score_val = 0

    if score_val >= 95:
        score_fill = PatternFill(start_color="27AE60", end_color="27AE60", fill_type="solid")
    elif score_val >= 85:
        score_fill = PatternFill(start_color="F39C12", end_color="F39C12", fill_type="solid")
    else:
        score_fill = PatternFill(start_color="E74C3C", end_color="E74C3C", fill_type="solid")
    score_font = Font(color="FFFFFF", bold=True, size=14)

    # Error type colors
    accuracy_fill = PatternFill(start_color="C0392B", end_color="C0392B", fill_type="solid")
    language_fill = PatternFill(start_color="E67E22", end_color="E67E22", fill_type="solid")
    style_fill = PatternFill(start_color="F39C12", end_color="F39C12", fill_type="solid")
    white_font = Font(color="FFFFFF", bold=True)

    border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )

    # Set column widths
    ws.column_dimensions['A'].width = 25
    ws.column_dimensions['B'].width = 60
    ws.column_dimensions['C'].width = 15
    ws.column_dimensions['D'].width = 60

    # Row counter
    current_row = 1

    # Title
    ws.merge_cells(f'A{current_row}:D{current_row}')
    title_cell = ws[f'A{current_row}']
    title_cell.value = "📊 Translation Quality Review Report"
    title_cell.font = Font(size=16, bold=True, color="2C3E50")
    title_cell.alignment = Alignment(horizontal='center', vertical='center')
    current_row += 2

    # Metadata section
    metadata = [
        ("File Name", row_data['fileName']),
        ("File ID", row_data['fileID']),
        ("Target Language", row_data['targetLang'].upper()),
        ("Processed", row_data['timestamp'] or 'N/A'),
        ("Model", row_data['model'] or 'GPT-5'),
    ]

    # Add ID columns info if available
    if row_data.get('id_cols'):
        metadata.append(("ID Columns", ', '.join(row_data['id_cols'])))

    for label, value in metadata:
        ws[f'A{current_row}'] = label
        ws[f'A{current_row}'].font = Font(bold=True)
        ws.merge_cells(f'B{current_row}:D{current_row}')
        ws[f'B{current_row}'] = value
        current_row += 1

    current_row += 1

    # Quality Score section
    ws.merge_cells(f'A{current_row}:D{current_row}')
    score_cell = ws[f'A{current_row}']
    score_cell.value = f"Quality Score: {row_data['qualityScore']}/100 ({row_data['qualityBand']})"
    score_cell.fill = score_fill
    score_cell.font = score_font
    score_cell.alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[current_row].height = 30
    current_row += 2

    # Error counts section
    ws[f'A{current_row}'] = "Error Type"
    ws[f'B{current_row}'] = "Count"
    ws[f'A{current_row}'].fill = header_fill
    ws[f'B{current_row}'].fill = header_fill
    ws[f'A{current_row}'].font = header_font
    ws[f'B{current_row}'].font = header_font
    ws[f'C{current_row}'].fill = header_fill
    ws[f'D{current_row}'].fill = header_fill
    current_row += 1

    error_data = [
        ("Accuracy Errors (-3 pts each)", row_data['accuracyErrors'], accuracy_fill),
        ("Language Quality Errors (-2 pts each)", row_data['languageErrors'], language_fill),
        ("Style/Fluency Errors (-1 pt each)", row_data['styleErrors'], style_fill),
    ]

    for label, count, fill in error_data:
        ws[f'A{current_row}'] = label
        ws[f'B{current_row}'] = count
        ws[f'B{current_row}'].fill = fill
        ws[f'B{current_row}'].font = white_font
        ws[f'B{current_row}'].alignment = Alignment(horizontal='center')
        current_row += 1

    current_row += 1

    # Improvements section
    ws.merge_cells(f'A{current_row}:D{current_row}')
    improvements_header = ws[f'A{current_row}']
    improvements_header.value = "Improvements Needed"
    improvements_header.fill = header_fill
    improvements_header.font = header_font
    improvements_header.alignment = Alignment(horizontal='center')
    current_row += 1

    # Parse improvements
    formatted_text = format_improvements(row_data['thingsToImprove'])
    items = [item.strip() for item in formatted_text.split('<br>') if item.strip()]

    if not items or items == ['-']:
        ws.merge_cells(f'A{current_row}:D{current_row}')
        ws[f'A{current_row}'] = "✅ Excellent translation quality - no improvements needed"
        ws[f'A{current_row}'].font = Font(italic=True, color="27AE60")
        ws[f'A{current_row}'].alignment = Alignment(horizontal='center')
        current_row += 1
    else:
        # Column headers
        ws[f'A{current_row}'] = "#"
        ws[f'B{current_row}'] = "Improvement Description"
        ws[f'C{current_row}'] = "Accept/Reject"
        ws[f'D{current_row}'] = "Linguist Comment"

        # Apply header styling
        for col in ['A', 'B', 'C', 'D']:
            ws[f'{col}{current_row}'].fill = PatternFill(start_color="ECF0F1", end_color="ECF0F1", fill_type="solid")
            ws[f'{col}{current_row}'].font = Font(bold=True)
            ws[f'{col}{current_row}'].border = border

        ws.column_dimensions['A'].width = 8
        ws.column_dimensions['B'].width = 80
        ws.column_dimensions['C'].width = 15
        ws.column_dimensions['D'].width = 80
        current_row += 1

        # Add each improvement item
        for idx, item in enumerate(items, 1):
            # Remove bullet if present
            item = item.lstrip('•- ').strip()

            # Determine error type and color
            if '[ACCURACY]' in item:
                item = item.replace('[ACCURACY]', '').strip()
                error_type = "🔴 ACCURACY"
                row_fill = PatternFill(start_color="FADBD8", end_color="FADBD8", fill_type="solid")
            elif '[LANGUAGE]' in item:
                item = item.replace('[LANGUAGE]', '').strip()
                error_type = "🟠 LANGUAGE"
                row_fill = PatternFill(start_color="FDEBD0", end_color="FDEBD0", fill_type="solid")
            elif '[STYLE]' in item:
                item = item.replace('[STYLE]', '').strip()
                error_type = "🟡 STYLE"
                row_fill = PatternFill(start_color="FCF3CF", end_color="FCF3CF", fill_type="solid")
            else:
                error_type = "ℹ️ INFO"
                row_fill = PatternFill(start_color="EBF5FB", end_color="EBF5FB", fill_type="solid")

            # Add item number (Column A)
            ws[f'A{current_row}'] = idx
            ws[f'A{current_row}'].alignment = Alignment(horizontal='center', vertical='top')
            ws[f'A{current_row}'].fill = row_fill
            ws[f'A{current_row}'].border = border

            # Add improvement description (Column B)
            full_text = f"{error_type}: {item}"
            ws[f'B{current_row}'] = full_text
            ws[f'B{current_row}'].alignment = Alignment(horizontal='left', vertical='top', wrap_text=True)
            ws[f'B{current_row}'].fill = row_fill
            ws[f'B{current_row}'].border = border

            # Add Accept/Reject column (Column C) - Empty for linguist to fill
            ws[f'C{current_row}'] = ""
            ws[f'C{current_row}'].alignment = Alignment(horizontal='center', vertical='top', wrap_text=True)
            ws[f'C{current_row}'].fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
            ws[f'C{current_row}'].border = border

            # Add Linguist Comment column (Column D) - Empty for linguist to fill
            ws[f'D{current_row}'] = ""
            ws[f'D{current_row}'].alignment = Alignment(horizontal='left', vertical='top', wrap_text=True)
            ws[f'D{current_row}'].fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
            ws[f'D{current_row}'].border = border

            # Auto-adjust row height based on text length
            estimated_lines = len(full_text) // 80 + 1
            ws.row_dimensions[current_row].height = max(30, estimated_lines * 15)

            current_row += 1

    current_row += 1

    # Footer
    ws.merge_cells(f'A{current_row}:D{current_row}')
    footer_cell = ws[f'A{current_row}']
    footer_cell.value = f"Generated by Translation Quality Review System | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    footer_cell.font = Font(size=9, italic=True, color="7F8C8D")
    footer_cell.alignment = Alignment(horizontal='center')

    # ----------------------------------------------------------------
    # Source Strings sheet (added when CSV is available)
    # ----------------------------------------------------------------
    if csv_path and os.path.exists(csv_path):
        target_lang_key = row_data.get('targetLang', '').strip()
        csv_rows, csv_id_cols = load_csv_rows_for_review(csv_path, target_lang_key)

        if csv_rows:
            ws2 = wb.create_sheet(title="Source Strings")

            # Column layout: Row # | ID cols... | EN (Source) | Translation | Notes
            id_col_letters = []
            col_idx = 1

            # Row # header
            ws2.cell(row=1, column=col_idx, value="Row #")
            ws2.cell(row=1, column=col_idx).font = header_font
            ws2.cell(row=1, column=col_idx).fill = header_fill
            ws2.cell(row=1, column=col_idx).alignment = Alignment(horizontal='center')
            ws2.column_dimensions[ws2.cell(row=1, column=col_idx).column_letter].width = 8
            col_idx += 1

            # ID columns
            for id_col in csv_id_cols:
                ws2.cell(row=1, column=col_idx, value=id_col)
                ws2.cell(row=1, column=col_idx).font = header_font
                ws2.cell(row=1, column=col_idx).fill = header_fill
                ws2.cell(row=1, column=col_idx).alignment = Alignment(horizontal='center')
                ws2.column_dimensions[ws2.cell(row=1, column=col_idx).column_letter].width = 28
                id_col_letters.append(col_idx)
                col_idx += 1

            # EN source column
            en_col_idx = col_idx
            ws2.cell(row=1, column=col_idx, value="Source (EN)")
            ws2.cell(row=1, column=col_idx).font = header_font
            ws2.cell(row=1, column=col_idx).fill = PatternFill(start_color="1A5276", end_color="1A5276", fill_type="solid")
            ws2.cell(row=1, column=col_idx).alignment = Alignment(horizontal='center')
            ws2.column_dimensions[ws2.cell(row=1, column=col_idx).column_letter].width = 60
            col_idx += 1

            # Translation column
            trans_col_idx = col_idx
            ws2.cell(row=1, column=col_idx, value=f"Translation ({target_lang_key.upper()})")
            ws2.cell(row=1, column=col_idx).font = header_font
            ws2.cell(row=1, column=col_idx).fill = PatternFill(start_color="1A5276", end_color="1A5276", fill_type="solid")
            ws2.cell(row=1, column=col_idx).alignment = Alignment(horizontal='center')
            ws2.column_dimensions[ws2.cell(row=1, column=col_idx).column_letter].width = 60
            col_idx += 1

            # Reviewer Notes column (empty — for human reviewer)
            notes_col_idx = col_idx
            ws2.cell(row=1, column=col_idx, value="Reviewer Notes")
            ws2.cell(row=1, column=col_idx).font = header_font
            ws2.cell(row=1, column=col_idx).fill = PatternFill(start_color="4A235A", end_color="4A235A", fill_type="solid")
            ws2.cell(row=1, column=col_idx).alignment = Alignment(horizontal='center')
            ws2.column_dimensions[ws2.cell(row=1, column=col_idx).column_letter].width = 40

            # Freeze header row
            ws2.freeze_panes = "A2"

            # Auto-filter
            last_col_letter = ws2.cell(row=1, column=notes_col_idx).column_letter
            ws2.auto_filter.ref = f"A1:{last_col_letter}1"

            # Data rows
            alt_fill_a = PatternFill(start_color="EAF2FF", end_color="EAF2FF", fill_type="solid")
            alt_fill_b = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
            wrap_left = Alignment(horizontal='left', vertical='top', wrap_text=True)

            for r_idx, csv_row in enumerate(csv_rows, start=2):
                row_fill = alt_fill_a if r_idx % 2 == 0 else alt_fill_b

                # Row #
                c = ws2.cell(row=r_idx, column=1, value=csv_row['row'])
                c.alignment = Alignment(horizontal='center', vertical='top')
                c.fill = row_fill
                c.border = border

                # ID columns
                for i, id_col in enumerate(csv_id_cols):
                    c = ws2.cell(row=r_idx, column=2 + i, value=csv_row['ids'].get(id_col, ''))
                    c.alignment = Alignment(horizontal='left', vertical='top')
                    c.fill = row_fill
                    c.border = border

                # EN source
                c = ws2.cell(row=r_idx, column=en_col_idx, value=csv_row['en'])
                c.alignment = wrap_left
                c.fill = row_fill
                c.border = border

                # Translation
                c = ws2.cell(row=r_idx, column=trans_col_idx, value=csv_row['target'])
                c.alignment = wrap_left
                c.fill = row_fill
                c.border = border

                # Reviewer Notes (empty)
                c = ws2.cell(row=r_idx, column=notes_col_idx, value="")
                c.alignment = wrap_left
                c.fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
                c.border = border

                # Row height based on longest cell text
                max_len = max(len(csv_row['en']), len(csv_row['target']))
                ws2.row_dimensions[r_idx].height = max(18, min(max_len // 60 + 1, 6) * 15)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Save workbook
    wb.save(output_path)

    return output_path


def convert_improvements_to_html_v2(text):
    """Convert improvement text with <br> tags to proper HTML list (v2.0)."""
    if not text or text == '-':
        return '<p class="no-improvements">Excellent translation quality - no improvements needed</p>'

    # Split on <br> tags
    items = [item.strip() for item in text.split('<br>') if item.strip()]

    if not items:
        return '<p class="no-improvements">Excellent translation quality - no improvements needed</p>'

    html_output = '<ul class="improvements-list">\n'
    for item in items:
        # Remove bullet points if present
        item = item.lstrip('•- ').strip()
        if item:
            # Protect error type markers
            item = item.replace('[ACCURACY]', '|||ACCURACY|||')
            item = item.replace('[LANGUAGE]', '|||LANGUAGE|||')
            item = item.replace('[STYLE]', '|||STYLE|||')

            # Escape HTML special characters
            item = html.escape(item)

            # Restore error type markers with formatting
            if '|||ACCURACY|||' in item:
                item = item.replace('|||ACCURACY|||', '<span class="error-accuracy">[ACCURACY]</span>')
            if '|||LANGUAGE|||' in item:
                item = item.replace('|||LANGUAGE|||', '<span class="error-language">[LANGUAGE]</span>')
            if '|||STYLE|||' in item:
                item = item.replace('|||STYLE|||', '<span class="error-style">[STYLE]</span>')

            html_output += f'  <li>{item}</li>\n'
    html_output += '</ul>'

    return html_output


def generate_single_html_report(row_data, output_path):
    """Generate HTML report for a single translation evaluation."""

    score_class = get_score_class(row_data['qualityScore'], row_data['qualityBand'])

    # Format improvements
    formatted_improvements = format_improvements(row_data['thingsToImprove'])
    improvements_html = convert_improvements_to_html_v2(formatted_improvements)

    # Count improvement items
    item_count = len([item for item in formatted_improvements.split('<br>') if item.strip()])

    # Compute summary stats
    try:
        score_val = int(row_data['qualityScore'])
    except (ValueError, TypeError):
        score_val = 0

    try:
        accuracy_count = int(row_data['accuracyErrors'])
    except (ValueError, TypeError):
        accuracy_count = 0

    try:
        language_count = int(row_data['languageErrors'])
    except (ValueError, TypeError):
        language_count = 0

    try:
        style_count = int(row_data['styleErrors'])
    except (ValueError, TypeError):
        style_count = 0

    accuracy_pts = accuracy_count * 3
    language_pts = language_count * 2
    style_pts = style_count * 1
    total_deducted = accuracy_pts + language_pts + style_pts

    band = (row_data['qualityBand'] or '').strip()
    if band == 'High':
        verdict_color = '#27ae60'
        verdict_bg = '#d5f4e6'
        verdict_icon = '✅'
        verdict_label = 'High Quality'
        verdict_summary = 'This translation demonstrates strong accuracy and fluency with minimal errors.'
    elif band == 'Medium':
        verdict_color = '#e67e22'
        verdict_bg = '#fef9e7'
        verdict_icon = '⚠️'
        verdict_label = 'Medium Quality'
        verdict_summary = 'This translation is generally acceptable but has notable issues that should be addressed before publication.'
    else:
        verdict_color = '#e74c3c'
        verdict_bg = '#fdf2f0'
        verdict_icon = '❌'
        verdict_label = 'Low Quality'
        verdict_summary = 'This translation requires significant revision before it can be considered publication-ready.'

    concern_parts = []
    if accuracy_pts > 0:
        concern_parts.append(f"{accuracy_count} accuracy error{'s' if accuracy_count != 1 else ''} (&minus;{accuracy_pts} pts)")
    if language_pts > 0:
        concern_parts.append(f"{language_count} language error{'s' if language_count != 1 else ''} (&minus;{language_pts} pts)")
    if style_pts > 0:
        concern_parts.append(f"{style_count} style error{'s' if style_count != 1 else ''} (&minus;{style_pts} pts)")
    concerns_html = " &nbsp;&bull;&nbsp; ".join(concern_parts) if concern_parts else "No issues found"

    summary_section = f"""
        <div class="summary-section">
            <div class="verdict-banner" style="background:{verdict_bg}; border-left:5px solid {verdict_color};">
                <div class="verdict-icon">{verdict_icon}</div>
                <div class="verdict-content">
                    <div class="verdict-label" style="color:{verdict_color};">{verdict_label}</div>
                    <div class="verdict-body">{verdict_summary}</div>
                </div>
                <div class="verdict-score" style="color:{verdict_color};">{score_val}<span class="verdict-score-denom">/100</span></div>
            </div>
            <div class="score-bar-row">
                <div class="score-bar-label">Quality Score</div>
                <div class="score-bar-track">
                    <div class="score-bar-fill" style="width:{score_val}%; background:{verdict_color};"></div>
                </div>
                <div class="score-bar-pct">{score_val}%</div>
            </div>
            <div class="deduction-row">
                <span class="deduction-label">Points deducted:</span>
                <span class="deduction-detail">{concerns_html}</span>
                {'<span class="deduction-total"> = &minus;' + str(total_deducted) + ' total</span>' if total_deducted > 0 else ''}
            </div>
        </div>"""

    # Build ID columns note if available
    id_note = ""
    if row_data.get('id_cols'):
        id_note = f"""
            <div class="id-note">
                <strong>📌 ID Columns Available:</strong> {', '.join(row_data['id_cols'])} - These IDs help locate specific records accurately.
            </div>"""

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Translation Quality Review - {row_data['fileName']}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}

        header {{
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}

        h1 {{
            color: #2c3e50;
            font-size: 28px;
            margin-bottom: 10px;
        }}

        .meta {{
            color: #666;
            font-size: 14px;
            margin-top: 10px;
        }}

        .id-note {{
            background: #e3f2fd;
            padding: 12px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 4px solid #2196f3;
            font-size: 13px;
            color: #1565c0;
        }}

        .id-note strong {{
            color: #0d47a1;
        }}

        .scoring-info {{
            background: #fff8e1;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 4px solid #ffc107;
            font-size: 13px;
        }}

        .scoring-info h3 {{
            color: #f57c00;
            margin-bottom: 8px;
            font-size: 15px;
        }}

        .translation-card {{
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 25px;
            margin-top: 25px;
            background: #fafafa;
        }}

        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 15px;
        }}

        .file-info {{
            flex: 1;
            min-width: 300px;
        }}

        .file-id {{
            color: #7f8c8d;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 5px;
        }}

        .file-name {{
            color: #2c3e50;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 5px;
        }}

        .target-lang {{
            display: inline-block;
            background: #3498db;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
        }}

        .score-section {{
            display: flex;
            align-items: center;
            gap: 15px;
        }}

        .score-badge {{
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 24px;
            font-weight: bold;
            color: white;
            min-width: 70px;
            text-align: center;
        }}

        .score-high {{
            background: linear-gradient(135deg, #27ae60, #229954);
        }}

        .score-medium {{
            background: linear-gradient(135deg, #f39c12, #e67e22);
        }}

        .score-low {{
            background: linear-gradient(135deg, #e74c3c, #c0392b);
        }}

        .score-unknown {{
            background: #95a5a6;
        }}

        .error-counts {{
            background: white;
            padding: 15px;
            border-radius: 6px;
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }}

        .error-stat {{
            text-align: center;
        }}

        .error-number {{
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 3px;
        }}

        .error-label {{
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
        }}

        .accuracy .error-number {{
            color: #c0392b;
        }}

        .language .error-number {{
            color: #e67e22;
        }}

        .style .error-number {{
            color: #f39c12;
        }}

        .improvements-section {{
            margin-top: 20px;
        }}

        .improvements-title {{
            font-size: 16px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 12px;
        }}

        .improvements-list {{
            list-style: none;
            padding: 0;
            margin: 0;
        }}

        /* v2.0: Maximum width constraint + better wrapping */
        .improvements-list li {{
            padding: 14px 16px;
            margin-bottom: 10px;
            background: white;
            border-left: 4px solid #3498db;
            border-radius: 4px;
            line-height: 1.9;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;

            /* Proper word wrapping */
            max-width: 100%;
            word-wrap: break-word;
            word-break: normal;
            overflow-wrap: break-word;
            white-space: pre-wrap;
            display: block;

            /* Better text rendering */
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }}

        /* v2.0: Better error type badges */
        .error-accuracy {{
            background: #c0392b;
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            display: inline-block;
            margin-right: 8px;
            white-space: nowrap;
            vertical-align: baseline;
        }}

        .error-language {{
            background: #e67e22;
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            display: inline-block;
            margin-right: 8px;
            white-space: nowrap;
            vertical-align: baseline;
        }}

        .error-style {{
            background: #f39c12;
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            display: inline-block;
            margin-right: 8px;
            white-space: nowrap;
            vertical-align: baseline;
        }}

        .no-improvements {{
            color: #27ae60;
            font-style: italic;
            padding: 12px 15px;
            background: #d5f4e6;
            border-left: 4px solid #27ae60;
            border-radius: 4px;
        }}

        footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #7f8c8d;
            font-size: 13px;
        }}

        .summary-section {{
            margin-bottom: 25px;
        }}

        .verdict-banner {{
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 18px 20px;
            border-radius: 8px;
            margin-bottom: 14px;
        }}

        .verdict-icon {{
            font-size: 28px;
            flex-shrink: 0;
        }}

        .verdict-content {{
            flex: 1;
        }}

        .verdict-label {{
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 4px;
        }}

        .verdict-body {{
            font-size: 14px;
            color: #555;
        }}

        .verdict-score {{
            font-size: 38px;
            font-weight: 800;
            flex-shrink: 0;
            line-height: 1;
        }}

        .verdict-score-denom {{
            font-size: 18px;
            font-weight: 500;
            opacity: 0.7;
        }}

        .score-bar-row {{
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 10px;
        }}

        .score-bar-label {{
            font-size: 13px;
            font-weight: 600;
            color: #555;
            width: 110px;
            flex-shrink: 0;
        }}

        .score-bar-track {{
            flex: 1;
            height: 12px;
            background: #e8e8e8;
            border-radius: 6px;
            overflow: hidden;
        }}

        .score-bar-fill {{
            height: 100%;
            border-radius: 6px;
        }}

        .score-bar-pct {{
            font-size: 13px;
            font-weight: 600;
            color: #555;
            width: 40px;
            text-align: right;
        }}

        .deduction-row {{
            font-size: 13px;
            color: #666;
            padding: 10px 15px;
            background: #f8f8f8;
            border-radius: 6px;
        }}

        .deduction-label {{
            font-weight: 600;
            color: #444;
            margin-right: 6px;
        }}

        .deduction-total {{
            font-weight: 600;
            color: #c0392b;
        }}

        @media (max-width: 768px) {{
            .card-header {{
                flex-direction: column;
            }}

            .error-counts {{
                flex-direction: column;
                gap: 10px;
            }}

            .improvements-list li {{
                font-size: 13px;
                padding: 12px 14px;
                line-height: 1.8;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📊 Translation Quality Review Report</h1>
            <div class="meta">
                <strong>File:</strong> {row_data['fileName']}<br>
                <strong>Target Language:</strong> {row_data['targetLang'].upper()}<br>
                <strong>Processed:</strong> {row_data['timestamp'] or 'N/A'}<br>
                <strong>Model:</strong> {row_data['model'] or 'GPT-5'}
            </div>{id_note}
            <div class="scoring-info">
                <h3>Scoring System</h3>
                <strong>Starting Score: 100 points</strong><br>
                • Accuracy Errors: -3 points each (mistranslations, missing/added info)<br>
                • Language Quality Errors: -2 points each (grammar, spelling, terminology)<br>
                • Style/Fluency Errors: -1 point each (unnatural phrasing, awkward structure)<br>
                <strong>Quality Bands:</strong> High (95-100) | Medium (85-94) | Low (&lt;85)
            </div>
        </header>
{summary_section}
        <div class="translation-card">
            <div class="card-header">
                <div class="file-info">
                    <div class="file-id">File ID: {row_data['fileID']}</div>
                    <div class="file-name">{row_data['fileName']}</div>
                    <span class="target-lang">{row_data['targetLang'].upper()}</span>
                </div>
                <div class="score-section">
                    <div class="score-badge {score_class}">{row_data['qualityScore']}</div>
                </div>
            </div>

            <div class="error-counts">
                <div class="error-stat accuracy">
                    <div class="error-number">{row_data['accuracyErrors']}</div>
                    <div class="error-label">Accuracy Errors</div>
                </div>
                <div class="error-stat language">
                    <div class="error-number">{row_data['languageErrors']}</div>
                    <div class="error-label">Language Errors</div>
                </div>
                <div class="error-stat style">
                    <div class="error-number">{row_data['styleErrors']}</div>
                    <div class="error-label">Style Errors</div>
                </div>
            </div>

            <div class="improvements-section">
                <div class="improvements-title">Improvements Needed ({item_count} items):</div>
                {improvements_html}
            </div>
        </div>

        <footer>
            <p>Translation Quality Review Report | Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | GPT-5</p>
        </footer>
    </div>
</body>
</html>
"""

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Write HTML file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)

    return output_path


def copy_csv_to_reports(csv_folder, html_output_folder):
    """Copy CSV source files to HTML report folders for reference."""
    if not csv_folder or not os.path.exists(csv_folder):
        return 0

    print(f"\n📋 Copying CSV source files to report folders...")

    # Find all CSV files
    csv_files = glob.glob(os.path.join(csv_folder, "*.csv"))

    if not csv_files:
        return 0

    copied_count = 0
    import shutil

    for csv_file in csv_files:
        try:
            filename = os.path.basename(csv_file)
            name = Path(filename).stem

            # Try to extract formId (number after formId_)
            form_id_match = re.search(r'formId[_-](\d+)', name, re.IGNORECASE)
            form_id = form_id_match.group(1) if form_id_match else None

            # Try to extract language code after formId
            # Pattern: formId_XXXXX_XX_ or formId_XXXXX_XX_YY_
            lang_match = re.search(r'formId[_-]\d+[_-]([a-z]{2}(?:[_-][a-z]{2})?)[_-]', name, re.IGNORECASE)
            if lang_match:
                language = lang_match.group(1)
            else:
                # Fallback: find any 2-letter language code
                parts = name.split('_')
                language = None
                for part in parts:
                    if re.match(r'^[a-z]{2}(?:[_-][a-z]{2})?$', part, re.IGNORECASE):
                        language = part
                        break

            if language and form_id:
                # Copy to language/formId folder
                output_dir = Path(html_output_folder) / language / form_id
                if output_dir.exists():  # Only copy if report folder exists
                    destination = output_dir / (Path(filename).stem + '-data.csv')
                    shutil.copy2(csv_file, destination)
                    copied_count += 1

        except Exception:
            pass  # Skip files that can't be copied

    if copied_count > 0:
        print(f"  ✅ Copied {copied_count} CSV source file(s)")

    return copied_count


def process_individual_results(results_folder, html_output_folder, csv_folder=None):
    """Step 2: Process individual MD result files to HTML and Excel reports."""
    print("\n" + "="*60)
    print("STEP 2: PROCESSING INDIVIDUAL RESULTS TO HTML/EXCEL")
    print("="*60 + "\n")

    # Find all _result.md files
    md_files = glob.glob(os.path.join(results_folder, "*_result.md"))

    if not md_files:
        print(f"⚠️  No individual result files found in {results_folder}")
        return []

    print(f"📋 Found {len(md_files)} individual result file(s)")
    print(f"📂 Output Directory: {html_output_folder}\n")

    success_count = 0
    failed_count = 0
    generated_reports = []

    for idx, md_file in enumerate(md_files, 1):
        filename = os.path.basename(md_file)
        print(f"[{idx}/{len(md_files)}] Processing: {filename}")

        try:
            # Parse MD file
            row_data = parse_markdown_file(md_file)

            if not row_data:
                print("  ❌ Could not parse MD file - skipping\n")
                failed_count += 1
                continue

            # Extract file info
            form_id, language = extract_file_info(filename)

            # Show basic info
            total_errors = int(row_data['accuracyErrors']) + int(row_data['languageErrors']) + int(row_data['styleErrors'])
            print(f"  Language: {language.upper()} | Form ID: {form_id} | Score: {row_data['qualityScore']}/100 ({row_data['qualityBand']}) | Errors: {total_errors}")

            # Create output directory: language/formId
            output_dir = Path(html_output_folder) / language / form_id
            base_filename = Path(md_file).stem

            html_path = output_dir / (base_filename + '.html')
            excel_path = output_dir / (base_filename + '.xlsx')

            # Generate HTML report
            html_result = generate_single_html_report(row_data, str(html_path))

            # Derive CSV source path from MD filename
            csv_source_path = None
            if csv_folder:
                md_stem = Path(md_file).stem  # e.g. formId_20042_zh_cn_20260204_155058_zh_cn_result
                csv_stem = md_stem
                if csv_stem.endswith('_result'):
                    csv_stem = csv_stem[:-7]
                target_lang_suffix = '_' + row_data['targetLang']
                if csv_stem.endswith(target_lang_suffix):
                    csv_stem = csv_stem[:-len(target_lang_suffix)]
                candidate = os.path.join(csv_folder, csv_stem + '.csv')
                if os.path.exists(candidate):
                    csv_source_path = candidate

            # Generate Excel report
            excel_result = generate_excel_report(row_data, str(excel_path), csv_path=csv_source_path)

            # Show output
            print(f"  Output: {output_dir}")
            print(f"    ├── HTML: {html_path.name}")
            if excel_result:
                print(f"    └── Excel: {excel_path.name}")
            print(f"  ✅ Reports generated successfully!\n")

            generated_reports.append({
                'html': html_result,
                'excel': excel_result,
                'language': language,
                'form_id': form_id
            })

            success_count += 1

        except Exception as e:
            print(f"  ❌ Error: {e}\n")
            failed_count += 1

    # Copy CSV source files if folder is provided
    if csv_folder and generated_reports:
        copy_csv_to_reports(csv_folder, html_output_folder)

    print(f"✅ Step 2 Complete: {success_count} successful, {failed_count} failed")
    return generated_reports


# ============================================================================
# STEP 3: HTML GENERATION (MASTER REPORT - OPTIONAL)
# ============================================================================

def parse_markdown_table(md_content):
    """Parse markdown content and extract translation evaluation data."""
    lines = md_content.strip().split('\n')
    
    timestamp = None
    for line in lines:
        if line.startswith('**Generated:**'):
            timestamp = line.replace('**Generated:**', '').strip()
            break
    
    rows = []
    in_table = False
    header_found = False
    
    print(f"  🔍 Debugging: Total lines in file: {len(lines)}")
    
    for idx, line in enumerate(lines):
        # Check for table header
        if '| fileID |' in line and '| fileName |' in line and '| targetLang |' in line:
            header_found = True
            print(f"  ✓ Found table header at line {idx}")
            continue
        
        # Check for separator line
        if '|---|---|---|---|' in line or '|--------|' in line:
            in_table = True
            print(f"  ✓ Found table separator at line {idx}")
            continue
        
        if not line.strip().startswith('|'):
            continue
        
        # Parse table row
        cells = [cell.strip() for cell in line.split('|')]
        cells = [c for c in cells if c]  # Remove empty cells
        
        # Debug: show what we're parsing
        if in_table and len(cells) > 0:
            print(f"  Line {idx}: Found {len(cells)} cells - First cell: '{cells[0][:30] if cells[0] else 'empty'}'")
        
        # Skip if not enough columns (need at least 9: fileID, fileName, targetLang, score, band, acc, lang, style, improve)
        if len(cells) < 9:
            if in_table and len(cells) > 0:
                print(f"    ⚠️  Skipped - only {len(cells)} columns (need 9)")
            continue
        
        # Skip header row
        if cells[0].lower() == 'fileid':
            continue
        
        # Add valid row
        if in_table and cells[0] and cells[1]:
            rows.append({
                'fileID': cells[0],
                'fileName': cells[1],
                'targetLang': cells[2],
                'qualityScore': cells[3],
                'qualityBand': cells[4],
                'accuracyErrors': cells[5],
                'languageErrors': cells[6],
                'styleErrors': cells[7],
                'thingsToImprove': cells[8]
            })
            print(f"  ✓ Parsed row: {cells[0]} - {cells[1]} ({cells[2]}) - Score: {cells[3]}")
    
    print(f"  📊 Total rows parsed: {len(rows)}")
    
    if not rows and header_found:
        print(f"  ⚠️  Header found but no data rows. Check table format.")
        print(f"  💡 Showing first data line after header:")
        for idx, line in enumerate(lines):
            if in_table and line.strip().startswith('|') and 'fileID' not in line and '---' not in line:
                print(f"    Line {idx}: {line[:200]}")
                break
    
    return timestamp, rows


def convert_improvements_to_html(text):
    """Convert improvement text with <br> tags to proper HTML list."""
    if not text or text == '-':
        return '<p class="no-improvements">Excellent translation quality - no improvements needed</p>'
    
    items = [item.strip() for item in text.split('<br>') if item.strip()]
    
    if not items:
        return '<p class="no-improvements">Excellent translation quality - no improvements needed</p>'
    
    html_output = '<ul class="improvements-list">\n'
    for item in items:
        item = item.lstrip('- ').strip()
        if item:
            # Color code error types
            if '[ACCURACY]' in item:
                item = item.replace('[ACCURACY]', '<span class="error-accuracy">[ACCURACY]</span>')
            elif '[LANGUAGE]' in item:
                item = item.replace('[LANGUAGE]', '<span class="error-language">[LANGUAGE]</span>')
            elif '[STYLE]' in item:
                item = item.replace('[STYLE]', '<span class="error-style">[STYLE]</span>')
            
            html_output += f'  <li>{item}</li>\n'
    html_output += '</ul>'
    
    return html_output


def get_score_class(score, band):
    """Return CSS class based on quality score and band."""
    try:
        score_val = int(score)
        if band == 'High' or score_val >= 95:
            return 'score-high'
        elif band == 'Medium' or score_val >= 85:
            return 'score-medium'
        else:
            return 'score-low'
    except (ValueError, TypeError):
        return 'score-unknown'


def generate_html(timestamp, rows, source_file):
    """Generate complete HTML document from parsed translation data."""
    
    # Calculate summary statistics
    total_evaluations = len(rows)
    high_quality = sum(1 for r in rows if r['qualityBand'] == 'High')
    medium_quality = sum(1 for r in rows if r['qualityBand'] == 'Medium')
    low_quality = sum(1 for r in rows if r['qualityBand'] == 'Low')
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Translation Quality Review Report</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        
        header {{
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        
        h1 {{
            color: #2c3e50;
            font-size: 28px;
            margin-bottom: 10px;
        }}
        
        .meta {{
            color: #666;
            font-size: 14px;
        }}
        
        .id-note {{
            background: #e3f2fd;
            padding: 12px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 4px solid #2196f3;
            font-size: 13px;
            color: #1565c0;
        }}
        
        .id-note strong {{
            color: #0d47a1;
        }}
        
        .scoring-info {{
            background: #fff8e1;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 4px solid #ffc107;
            font-size: 13px;
        }}
        
        .scoring-info h3 {{
            color: #f57c00;
            margin-bottom: 8px;
            font-size: 15px;
        }}
        
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }}
        
        .summary-card {{
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }}
        
        .summary-card.total {{
            background: linear-gradient(135deg, #444444 0%, #000000 100%);
            color: white;
        }}
        
        .summary-card.high {{
            background: linear-gradient(135deg, #444444 0%, #000000 100%);
            color: white;
        }}
        
        .summary-card.medium {{
            background: linear-gradient(135deg, #444444 0%, #000000 100%);
            color: white;
        }}
        
        .summary-card.low {{
            background: linear-gradient(135deg, #444444 0%, #000000 100%);
            color: white;
        }}
        
        .summary-number {{
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 5px;
        }}
        
        .summary-label {{
            font-size: 14px;
            opacity: 0.9;
        }}
        
        .translation-card {{
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 25px;
            margin-bottom: 25px;
            background: #fafafa;
        }}
        
        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 15px;
        }}
        
        .file-info {{
            flex: 1;
            min-width: 300px;
        }}
        
        .file-id {{
            color: #7f8c8d;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 5px;
        }}
        
        .file-name {{
            color: #2c3e50;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 5px;
        }}
        
        .target-lang {{
            display: inline-block;
            background: #3498db;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
        }}
        
        .score-section {{
            display: flex;
            align-items: center;
            gap: 15px;
        }}
        
        .score-badge {{
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 24px;
            font-weight: bold;
            color: white;
            min-width: 70px;
            text-align: center;
        }}
        
        .score-high {{
            background: linear-gradient(135deg, #27ae60, #229954);
        }}
        
        .score-medium {{
            background: linear-gradient(135deg, #f39c12, #e67e22);
        }}
        
        .score-low {{
            background: linear-gradient(135deg, #e74c3c, #c0392b);
        }}
        
        .score-unknown {{
            background: #95a5a6;
        }}
        
        .error-counts {{
            background: white;
            padding: 15px;
            border-radius: 6px;
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }}
        
        .error-stat {{
            text-align: center;
        }}
        
        .error-number {{
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 3px;
        }}
        
        .error-label {{
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
        }}
        
        .accuracy .error-number {{
            color: #c0392b;
        }}
        
        .language .error-number {{
            color: #e67e22;
        }}
        
        .style .error-number {{
            color: #f39c12;
        }}
        
        .improvements-section {{
            margin-top: 20px;
        }}
        
        .improvements-title {{
            font-size: 16px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 12px;
        }}
        
        .improvements-list {{
            list-style: none;
            padding: 0;
        }}
        
        .improvements-list li {{
            padding: 12px 15px;
            margin-bottom: 10px;
            background: white;
            border-left: 4px solid #3498db;
            border-radius: 4px;
            line-height: 1.6;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }}
        
        .error-accuracy {{
            background: #c0392b;
            color: white;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
        }}
        
        .error-language {{
            background: #e67e22;
            color: white;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
        }}
        
        .error-style {{
            background: #f39c12;
            color: white;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
        }}
        
        .no-improvements {{
            color: #27ae60;
            font-style: italic;
            padding: 12px 15px;
            background: #d5f4e6;
            border-left: 4px solid #27ae60;
            border-radius: 4px;
        }}
        
        footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #7f8c8d;
            font-size: 13px;
        }}
        
        @media (max-width: 768px) {{
            .summary {{
                grid-template-columns: 1fr;
            }}
            
            .card-header {{
                flex-direction: column;
            }}
            
            .error-counts {{
                flex-direction: column;
                gap: 10px;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📊 Translation Quality Review Report</h1>
            <div class="meta">
                <strong>Generated:</strong> {timestamp or 'N/A'}<br>
                <strong>Source:</strong> {source_file}<br>
                <strong>Model:</strong> GPT-5
            </div>
            <div class="id-note">
                <strong>📌 ID Column Support:</strong> This report uses mongoId, avettaId, or formDisplayID when available in CSV files to help translators locate specific records accurately.
            </div>
            <div class="scoring-info">
                <h3>Scoring System</h3>
                <strong>Starting Score: 100 points</strong><br>
                • Accuracy Errors: -3 points each (mistranslations, missing/added info)<br>
                • Language Quality Errors: -2 points each (grammar, spelling, terminology)<br>
                • Style/Fluency Errors: -1 point each (unnatural phrasing, awkward structure)<br>
                <strong>Quality Bands:</strong> High (95-100) | Medium (85-94) | Low (&lt;85)
            </div>
        </header>
        
        <div class="summary">
            <div class="summary-card total">
                <div class="summary-number">{total_evaluations}</div>
                <div class="summary-label">Total Evaluations</div>
            </div>
            <div class="summary-card high">
                <div class="summary-number">{high_quality}</div>
                <div class="summary-label">High Quality (95-100)</div>
            </div>
            <div class="summary-card medium">
                <div class="summary-number">{medium_quality}</div>
                <div class="summary-label">Medium Quality (85-94)</div>
            </div>
            <div class="summary-card low">
                <div class="summary-number">{low_quality}</div>
                <div class="summary-label">Low Quality (&lt;85)</div>
            </div>
        </div>
        
        <div class="translations-list">
"""
    
    for row in rows:
        score_class = get_score_class(row['qualityScore'], row['qualityBand'])
        improvements_html = convert_improvements_to_html(row['thingsToImprove'])
        
        html_content += f"""
            <div class="translation-card">
                <div class="card-header">
                    <div class="file-info">
                        <div class="file-id">File ID: {row['fileID']}</div>
                        <div class="file-name">{row['fileName']}</div>
                        <span class="target-lang">{row['targetLang'].upper()}</span>
                    </div>
                    <div class="score-section">
                        <div class="score-badge {score_class}">{row['qualityScore']}</div>
                    </div>
                </div>
                
                <div class="error-counts">
                    <div class="error-stat accuracy">
                        <div class="error-number">{row['accuracyErrors']}</div>
                        <div class="error-label">Accuracy Errors</div>
                    </div>
                    <div class="error-stat language">
                        <div class="error-number">{row['languageErrors']}</div>
                        <div class="error-label">Language Errors</div>
                    </div>
                    <div class="error-stat style">
                        <div class="error-number">{row['styleErrors']}</div>
                        <div class="error-label">Style Errors</div>
                    </div>
                </div>
                
                <div class="improvements-section">
                    <div class="improvements-title">Improvements Needed:</div>
                    {improvements_html}
                </div>
            </div>
"""
    
    html_content += f"""
        </div>
        
        <footer>
            <p>Translation Quality Review Report | Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | GPT-5</p>
        </footer>
    </div>
</body>
</html>
"""
    
    return html_content


def generate_html_report(md_file, output_folder):
    """Step 3: Generate HTML report from cleaned markdown."""
    print("\n" + "="*60)
    print("STEP 3: GENERATING HTML REPORT")
    print("="*60 + "\n")
    
    md_file = Path(md_file)
    
    if not md_file.exists():
        print(f"❌ Error: File '{md_file}' not found")
        return None
    
    print(f"📖 Reading: {md_file.name}\n")
    
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    timestamp, rows = parse_markdown_table(md_content)
    
    if not rows:
        print(f"\n❌ Warning: No valid table data found")
        return None
    
    print(f"\n✅ Parsed {len(rows)} translation evaluations")
    
    html_content = generate_html(timestamp, rows, md_file.name)
    
    output_path = Path(output_folder) / md_file.with_suffix('.html').name
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"✅ Step 3 Complete: HTML report saved to {output_path}")
    return output_path


# ============================================================================
# MAIN WORKFLOW
# ============================================================================

def main():
    """Execute the complete workflow: evaluate → process individual reports → generate master HTML."""
    print("\n" + "="*60)
    print("TRANSLATION QUALITY REVIEW - INTEGRATED WORKFLOW")
    print("="*60)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    try:
        # Step 1: Evaluate translations
        master_md = run_translation_evaluation(timestamp)
        if not master_md:
            print("\n⚠️  Workflow stopped at Step 1: Translation evaluation")
            print("   Please ensure CSV files are in the './translations/' folder")
            print("   CSV files must have 'en' column and target language columns (ja, zh, cs, zh-cn, etc.)")
            print("   Optional: Include mongoId, avettaId, or formDisplayID columns for better tracking\n")
            return

        # Step 2: Process individual MD result files to HTML/Excel
        html_output_folder = "./html_reports/"
        generated_reports = process_individual_results(OUTPUT_FOLDER, html_output_folder, INPUT_FOLDER)

        if not generated_reports:
            print("\n⚠️  Warning: No individual reports were generated")

        # Step 3: Clean markdown (optional - for master report)
        cleaned_md = clean_markdown_file(master_md)
        if not cleaned_md:
            print("\n⚠️  Warning: Master markdown cleaning failed")

        # Step 4: Generate master HTML report (optional)
        if cleaned_md:
            html_report = generate_html_report(cleaned_md, OUTPUT_FOLDER)
            if not html_report:
                print("\n⚠️  Warning: Master HTML generation failed")
        else:
            html_report = None

        # Final summary
        print("\n" + "="*60)
        print("✅ WORKFLOW COMPLETE!")
        print("="*60)
        print(f"\n📁 Output Files:")
        print(f"   • Raw markdown: {master_md}")
        if cleaned_md:
            print(f"   • Cleaned markdown: {cleaned_md}")
        if html_report:
            print(f"   • Master HTML report: {html_report}")
        print(f"   • Individual MD results: {OUTPUT_FOLDER}")
        print(f"   • Individual HTML/Excel reports: {html_output_folder}")

        if generated_reports:
            print(f"\n📊 Generated Individual Reports:")
            print(f"   • HTML Reports: {len([r for r in generated_reports if r.get('html')])}")
            print(f"   • Excel Reports: {len([r for r in generated_reports if r.get('excel')])}")

            # Organize by language
            by_language = {}
            for report in generated_reports:
                lang = report['language']
                if lang not in by_language:
                    by_language[lang] = []
                by_language[lang].append(report['form_id'])

            print(f"\n📁 Report Structure: {html_output_folder}")
            for lang in sorted(by_language.keys()):
                form_ids = sorted(set(by_language[lang]))
                print(f"   ├── {lang}/ ({len(form_ids)} form(s))")
                for form_id in form_ids[:3]:  # Show first 3
                    print(f"   │   └── {form_id}/")
                if len(form_ids) > 3:
                    print(f"   │       ... and {len(form_ids) - 3} more")

        print(f"\n🎉 All translation evaluations complete!")
        print(f"📊 Check the individual HTML/Excel reports for detailed quality scores and improvements!")
        print(f"📌 ID columns (mongoId, avettaId, formDisplayID) are included when available for precise record location")
        print(f"\n💡 Quick Access:")
        print(f"   • Open reports folder: explorer \"{html_output_folder}\"")
        if generated_reports and generated_reports[0].get('html'):
            print(f"   • Open first HTML: \"{generated_reports[0]['html']}\"")

    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        print(traceback.format_exc())


if __name__ == "__main__":
    main()