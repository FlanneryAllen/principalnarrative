# 🎯 Principal Views - Beginner's Guide

## What is Principal Views?
Principal Views helps you:
1. **Visualize** your app's architecture (like a map)
2. **Track** what happens in your app (using OTEL/telemetry)
3. **Debug** problems by seeing the flow of data

## Files in this folder:

### 📊 architecture.canvas
- This is your visual architecture diagram
- Open in VS Code with the Canvas extension to see it visually
- Shows Frontend → Backend → Database flow

### 📄 architecture.md
- Documentation explaining what your app does
- Written in plain English for anyone to understand

### 🔧 library.yaml
- Defines reusable components and styles
- Lists your services that emit telemetry (OTEL)
- Think of it as your "style guide"

### 🔄 user-login.workflow.yaml
- Example OTEL workflow
- Shows what telemetry events happen during login
- Helps track the user journey through your app

## How to View the Architecture:

### Option 1: VS Code (Recommended)
1. Install the "Canvas" extension in VS Code
2. Open `.principal-views/architecture.canvas`
3. You should see a visual diagram

### Option 2: Obsidian
1. Open Obsidian
2. Open this project folder as a vault
3. Navigate to `.principal-views/architecture.canvas`

### Option 3: Online Viewer
1. Go to https://jsoncanvas.tools/
2. Upload your `architecture.canvas` file

## Common Commands:

```bash
# Validate your files
npx @principal-ai/principal-view-cli@latest validate

# Create a new canvas
npx @principal-ai/principal-view-cli@latest create -n "my-feature"

# List all canvas files
npx @principal-ai/principal-view-cli@latest list
```

## Understanding OTEL (OpenTelemetry):

OTEL helps you track what's happening in your app:

1. **Traces**: Follow a request through your system
   - Example: User clicks login → Goes to GitHub → Returns with token → Creates session

2. **Spans**: Individual steps in a trace
   - Example: "Checking user credentials" (500ms)

3. **Events**: Things that happen
   - Example: "user.logged.in", "error.database.connection"

## Next Steps:

1. ✅ View the architecture diagram in your IDE
2. ✅ Look at the user-login workflow to understand OTEL
3. 🚀 Add more nodes to your architecture as you build
4. 🚀 Create workflows for other features (signup, data processing, etc.)

## Need Help?

- The canvas format is JSON-based, so you can edit it directly if needed
- Each node needs: id, type, x, y, width, height, color
- Each edge needs: id, fromNode, toNode, fromSide, toSide

## Tips for Beginners:

1. Start simple - don't try to map everything at once
2. Use groups to organize related components
3. Use different colors for different types of components
4. Keep your workflows focused on one user journey at a time
5. Update the architecture as your app grows

Remember: This is a living document! Update it as your app changes.