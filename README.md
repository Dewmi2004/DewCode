# DewCode - Automatic Correction & Suggestion System

## Overview

I've successfully added automatic code correction and suggestion features to DewCode! This system leverages the AI capabilities (Ollama/Qwen2.5-Coder) to analyze your code and provide real-time feedback.

## ✨ New Features

### 1. **Code Analysis & Corrections**
   - **Endpoint**: `POST /api/ai/correct`
   - **What it does**: Analyzes your code and identifies:
     - Errors (syntax, logic issues)
     - Warnings (potential problems)
     - Suggestions (best practices, improvements)
   - **Output**: 
     - List of issues with line numbers
     - Corrected code version
     - Explanation of fixes

### 2. **Code Suggestions**
   - **Endpoint**: `POST /api/ai/suggest`
   - **What it does**: Provides inline code completion suggestions based on context
   - **Output**: 2-3 practical suggestions with descriptions

### 3. **Frontend Integration**
   - New buttons: **🔍 Analyze** and **💡 Suggest**
   - New **Corrections Panel** to display results
   - One-click to apply corrections
   - Seamless integration with existing editor

## 🚀 How to Use

### Quick Start

1. **Start Ollama** (if not running):
   ```bash
   ollama serve
   ```

2. **Open a file** in DewCode editor

3. **Click "🔍 Analyze"** to:
   - Find issues in your code
   - Get corrected version
   - See explanations for each fix

4. **Click "💡 Suggest"** to:
   - Get inline code suggestions
   - Insert suggestions with one click

### Step-by-Step Workflow

#### Analyzing Code for Corrections:

```
1. Open/edit a file
2. Click "🔍 Analyze" button (top toolbar)
3. Wait for analysis (shows spinner)
4. Review issues in corrections panel:
   - ❌ Errors (critical)
   - ⚠️ Warnings (potential issues)
   - 💡 Suggestions (improvements)
5. Click "Apply Corrections" to use the corrected code
```

#### Getting Code Suggestions:

```
1. Open/edit a file
2. Click "💡 Suggest" button
3. Review suggestions in corrections panel
4. Click "Use" button on any suggestion to insert it
```

#### Switching Between Panels:

```
- Click "🔍 Corrections" button to show/hide corrections panel
- Click "✦ AI" button to switch to AI assistant
- Use same panel for both corrections and suggestions
```

## 📋 File Structure

### Backend Changes

**New controller methods** in `src/controllers/ai.controller.ts`:
- `correctCode()` - Analyzes code and returns corrections
- `suggestCode()` - Provides inline suggestions

**New routes** in `src/routes/ai.routes.ts`:
- `POST /api/ai/correct` - Protected endpoint for corrections
- `POST /api/ai/suggest` - Protected endpoint for suggestions

### Frontend Changes

**New files:**
- `src/services/aiApi.ts` - API service for corrections/suggestions
- `src/components/editor/CodeCorrections.tsx` - Corrections display panel
- `src/components/editor/CodeSuggestions.tsx` - Suggestions display panel

**Modified files:**
- `src/types/index.ts` - Added types: `CodeIssue`, `CodeCorrection`, `CodeSuggestion`
- `src/components/editor/EditorPage.tsx` - Integrated correction/suggestion UI

## 🔧 API Reference

### POST /api/ai/correct

**Request Body:**
```json
{
  "code": "your code here",
  "language": "typescript",
  "model": "qwen2.5-coder"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "type": "error|warning|suggestion",
        "line": 5,
        "message": "Description of issue",
        "fix": "suggested fix code"
      }
    ],
    "correctedCode": "fixed code here",
    "explanation": "explanation of changes"
  }
}
```

### POST /api/ai/suggest

**Request Body:**
```json
{
  "code": "your code here",
  "language": "typescript",
  "line": 10,
  "column": 5,
  "model": "qwen2.5-coder"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "text": "suggestion code",
        "description": "what this does"
      }
    ]
  }
}
```

## 🎯 Supported Languages

- JavaScript/TypeScript
- Python
- Java
- C/C++
- Go
- Rust
- SQL
- And many more (any language Ollama supports)

## ⚙️ Configuration

The system uses:
- **Ollama** for AI analysis
- **Qwen2.5-Coder** as default model (can be changed)
- **Temperature**: 0.3 for corrections (low for accuracy), 0.5 for suggestions
- **Timeout**: 120 seconds for Ollama requests

## 🔑 Key Components

### CodeCorrections.tsx
Displays:
- Issue summary (count and types)
- Expandable issue list with details
- Corrected code preview
- Explanation of changes
- "Apply Corrections" button

### CodeSuggestions.tsx
Displays:
- List of suggestions
- Code snippet for each
- Description/explanation
- "Use" button to insert

### aiApi Service
Provides methods:
- `correctCode()` - Get corrections
- `suggestCode()` - Get suggestions
- `generatePrompt()` - Send to AI chat

## 💡 Tips & Best Practices

1. **For best results:**
   - Use meaningful variable names
   - Add comments explaining complex logic
   - Provide context in code

2. **Temperature settings:**
   - Corrections use low temperature (0.3) for accuracy
   - Suggestions use medium temperature (0.5) for variety

3. **Error handling:**
   - If Ollama is offline, you'll see descriptive errors
   - Ensure `ollama serve` is running in background
   - Check if model is available: `ollama list`

4. **Performance:**
   - Analysis typically takes 3-15 seconds
   - Loading indicator shows during processing
   - Large files may take longer

## 🐛 Troubleshooting

### "Cannot connect to Ollama" error
```bash
# Ensure Ollama is running
ollama serve

# In another terminal, pull the model
ollama pull qwen2.5-coder
```

### Suggestions not working
- Check that Ollama is running
- Verify the model is available
- Ensure code is not empty

### Analysis takes too long
- Consider using a smaller code sample
- Check if other processes are using resources
- Try again after a moment

## 🚀 Future Enhancements

Possible improvements:
- Real-time inline suggestions as you type
- Integration with VS Code diagnostics
- Custom rule/linter integration
- Performance optimizations
- Different AI models support
- Language-specific analyzers
- Git diff integration

## 📚 Related Features

- **AI Assistant** (✦ AI button) - Chat with AI about code
- **Terminal** (&gt;_ button) - Run/execute code
- **Code Editor** - Monaco editor with IntelliSense

## ✅ What's Working

✓ Backend endpoints for corrections and suggestions  
✓ Frontend UI components  
✓ API integration  
✓ Error handling  
✓ Type safety (TypeScript)  
✓ UI/UX polish with proper styling  
✓ Loading states  
✓ One-click apply corrections  

Enjoy automatic code improvements! 🎉
