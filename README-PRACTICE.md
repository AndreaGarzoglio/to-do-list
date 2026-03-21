# 📝 TODO LIST - THREE VERSIONS

## Quick Start

Run the webpack dev server:
```bash
npm start
```

Then open in browser:
- **Main app**: http://localhost:8080/
- **Simple version (reference)**: http://localhost:8080/simple.html
- **Your practice version**: http://localhost:8080/app.html

---

## 📂 Folder Structure

### `src/` - Full-featured app (most complex)
- `index.html` - Main layout
- `index.js` - Complete implementation with advanced features
- `style.css` - Styling

### `src2/` - Simple version (reference/study)
- `simple.html` - Minimal layout
- `simple.js` - Clean, well-commented implementation (READ THIS!)
- `simple.css` - Modern styling
- **This is your guide** - Use the logic and comments as reference

### `src3/` - Your practice version (EMPTY TO START)
- `index.html` - Same HTML structure as src2
- `app.js` - **MOSTLY EMPTY** - Your job to fill it in!
- `app.css` - Already styled for you

---

## 🎯 Your Challenge

**Goal**: Rebuild the todo app in `src3/app.js` from scratch!

### How to do it:

1. **Open `src2/simple.js`** in one tab (your reference/guide)
2. **Open `src3/app.js`** in another tab (where you code)
3. **Follow the TODO comments** in `app.js` to know what to build next
4. **Reference the logic** from `src2/simple.js` for each section
5. **Test frequently**: Save, run `npm run build`, refresh browser at `/app.html`

### Step-by-step:

**Section 1 - Data Models (Classes)**
- [ ] Build `Todo` class with id, title, description, dueDate, priority
- [ ] Build `Project` class with id, name, todos array, and methods
- [ ] Build `TodoApp` class with all the project/todo management logic

**Section 2 - DOM Functions**
- [ ] Create `renderProjects()` to display all projects
- [ ] Create `renderTodos()` to display all todos
- [ ] Create `render()` to call both
- [ ] Create `showAddProjectModal()` for new project dialog
- [ ] Create `showAddTodoModal()` for new todo dialog
- [ ] Create `showTodoModal(todo)` for edit todo dialog

**Section 3 - Startup**
- [ ] Add `DOMContentLoaded` event listener
- [ ] Initialize app and render on page load
- [ ] Attach button click handlers
- [ ] Handle modal outside-click closing

---

## 💡 Tips

- **Don't copy-paste** - Type it out, it helps learning
- **Understand the logic first** - Read the comments in src2/simple.js
- **Test as you go** - Build one class/function at a time and test
- **Use the console** - Check for errors with `npm run build`
- **Reference the structure** - The order in src2/simple.js is the best way to organize it

---

## 🚀 When you're done

Your app at `/app.html` should:
- ✅ Show a list of projects in the sidebar
- ✅ Click a project to see its todos
- ✅ Click "+ New Project" to create projects
- ✅ Click "+ Add Todo" to create todos
- ✅ Click a todo to edit it
- ✅ Delete projects and todos
- ✅ Save/load from localStorage (data persists!)

Good luck! 🎉
