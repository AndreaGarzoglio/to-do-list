import './app.css';

// ════════════════════════════════════════════════════════════════════
// TODO APP - ARCHITECTURE & DESIGN GUIDE
// ════════════════════════════════════════════════════════════════════
// 
// HIGH-LEVEL FLOW:
// 1. USER CREATES A PROJECT (container for todos)
// 2. USER CLICKS PROJECT → SETS AS ACTIVE (shows its todos)
// 3. USER ADDS/EDITS/DELETES TODOS IN ACTIVE PROJECT
// 4. DATA AUTOMATICALLY SAVED TO LOCALSTORAGE VIA PROXY PATTERN
// 5. ON PAGE LOAD, DATA IS RESTORED FROM STORAGE
// 6. UI RENDERS BY CALLING render() WHICH UPDATES ALL DOM ELEMENTS
//
// KEY DESIGN PATTERNS USED:
// • PROXY PATTERN: Automatically saves data when app.projects or activeProjectId changes
// • CLASS-BASED MODELS: Todo, Project, TodoApp encapsulate data & behavior
// • SEPARATION OF CONCERNS: Data logic (classes) vs. UI logic (render functions)
// • EVENT-DRIVEN UI: Button clicks trigger modal displays and data updates
// • SINGLE RENDER FUNCTION: Calling render() updates entire UI after any change
//
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// SECTION 1: DATA MODELS (App Logic)
// ════════════════════════════════════════════════════════════════════


class Todo {
    constructor(title, description = '', dueDate = '', priority = 'medium') {
        this.id = crypto.randomUUID();
        this.title = title;
        this.description = description;
        this.dueDate = dueDate;
        this.priority = priority;
        this.completed = false;  // Track if todo is done
    }
}



// ━━━ PROJECT CLASS ━━━
// PURPOSE: Container for todos. Manages a group of tasks.
// PSEUDO-CODE:
// • new Project(name): Create project with unique ID and empty todos array
// • addTodo(todo): Push todo to project's todos array
// • removeTodo(todoId): Filter out todo with matching ID
// • getTodo(todoId): Find and return specific todo by ID
class Project {
    constructor(name) {
        this.id = crypto.randomUUID();
        this.name = name;
        this.todos = [];
    }

    addTodo(todo) {
        this.todos.push(todo);
    };

    removeTodo(todoId) {
        this.todos = this.todos.filter(todo => todo.id !== todoId)
    };
    getTodo(todoId) {
        return this.todos.find(todo => todo.id === todoId);
    };
};



// ━━━ TODOAPP CLASS - MAIN APPLICATION STATE ━━━
// PURPOSE: Central manager of all projects and todos. Handles data persistence via Proxy.
// PSEUDO-CODE:
// • constructor(): Initialize empty projects array, set activeProjectId to null, 
//   wrap this in Proxy that auto-saves on top-level mutations
// • createProject(name): Create new Project, push to array, set as active, return it
// • deleteProject(projectId): Remove project from array, reset active if deleted project was active
// • getProject(projectId): Find and return project by ID
// • setActiveProject(projectId): Update which project is currently selected
// • getActiveProject(): Return the currently selected project object
// • addTodoToActiveProject(...): Create Todo, add to active project, save
// • deleteTodo(todoId): Remove todo from active project, save
// • updateTodo(todoId, updates): Find todo, merge updates into it, save
// • save(): Convert projects array to JSON and store in localStorage
// • load(): Retrieve JSON from localStorage, reconstruct Project & Todo instances
// • init(): Load data, create default project if first time, trigger save
class TodoApp {
    constructor() {
        this.projects = [];
        this.activeProjectId = null;


        return new Proxy(this, {
            set: (target, prop, value) => {
                target[prop] = value;
                target.save();
                return true;
            }
        });
    }

    //Project Methods

    createProject(name) {
        const project = new Project(name);
        this.projects.push(project);
        this.activeProjectId = project.id;
        return project;
    }

    deleteProject(projectId) {
        this.projects = this.projects.filter(p => p.id !== projectId);
        if (this.activeProjectId === projectId) {
            this.activeProjectId = this.projects[0]?.id || null;
        }
    }

    getProject(projectId) {
        return this.projects.find(p => p.id === projectId);
    }

    setActiveProject(projectId) {
        this.activeProjectId = projectId;
    }

    getActiveProject() {
        return this.getProject(this.activeProjectId);
    }

    //Todo Methods

    addTodoToActiveProject(title, description, dueDate, priority) {
        const activeProject = this.getActiveProject();
        if (!activeProject) return;
        const todo = new Todo(title, description, dueDate, priority);
        activeProject.addTodo(todo);
        this.save();
        return todo;
    }

    deleteTodo(todoId) {
        const activeProject = this.getActiveProject();
        if (activeProject) {
            activeProject.removeTodo(todoId);
            this.save();
        }
    }

    updateTodo(todoId, updates) {
        const activeProject = this.getActiveProject();
        const todo = activeProject?.getTodo(todoId);
        if (todo) {
            Object.assign(todo, updates);
            this.save();
        }
    }

    save() {
        const data = JSON.stringify(this.projects);
        localStorage.setItem('todoAppData', data);
    }

    load() {
        const data = localStorage.getItem('todoAppData');
        if (!data) return;

        try {
            const parsed = JSON.parse(data);
            this.projects = parsed.map(p => {
                const project = new Project(p.name);
                project.id = p.id;

                project.todos = p.todos.map(t => {
                    const todo = new Todo(t.title, t.description, t.dueDate, t.priority);
                    todo.id = t.id;
                    todo.completed = t.completed;  // Restore completion status from storage
                    return todo;
                });
                return project;
            });
            this.activeProjectId = this.projects[0]?.id || null;
        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }

    init() {
        this.load();

        if (this.projects.length === 0) {
            this.createProject('My Tasks');
            const activeProject = this.getActiveProject();
            activeProject.addTodo(new Todo('Buy groceries', 'Milk, eggs, bread', '2025-03-20', 'high'));
            activeProject.addTodo(new Todo('Finish project', 'Complete the UI', '2025-03-25', 'medium'));
            activeProject.addTodo(new Todo('Read book', 'Chapter 5-6', '2025-03-30', 'low'));
            this.save();
        }
    }





};

// ════════════════════════════════════════════════════════════════════
// SECTION 2: DOM MANIPULATION (Interface/Display)
// ════════════════════════════════════════════════════════════════════

const app = new TodoApp();


// ━━━ RENDER PROJECTS ━━━
// PURPOSE: Update project list in sidebar to reflect current app state
// PSEUDO-CODE:
// • Clear projectsList from DOM
// • For each project in app.projects:
//   - Create <li> with project name
//   - Highlight with .active class if project.id === app.activeProjectId
//   - Add delete button (✕) that removes project
//   - Add click handler to select project as active
//   - Append to projectsList
function renderProjects() {
    const projectsList = document.getElementById('projectsList');
    projectsList.innerHTML = '';

    app.projects.forEach(project => {
        const li = document.createElement('li');
        li.className = 'project-item';

        if (project.id === app.activeProjectId) {
            li.classList.add('active');
        }

        const name = document.createElement('span');
        name.textContent = project.name;
        name.style.cursor = 'pointer';


        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '✕';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Delete project "${project.name}"?`)) {
                app.deleteProject(project.id);
                render();
            }
        };

        li.appendChild(name);
        li.appendChild(deleteBtn);

        li.onclick = (e) => {

            if (e.target === deleteBtn) return;

            app.setActiveProject(project.id);
            render();
        };

        projectsList.appendChild(li);
    })
}

// ━━━ RENDER TODOS ━━━
// PURPOSE: Update todo list in main area to show todos of active project
// PSEUDO-CODE:
// • Get active project
// • Clear todosList from DOM
// • Update page title to show active project name
// • Sort todos: incomplete first, completed at bottom (priority)
// • For each todo in sorted list:
//   - Create <li> with checkbox, title, date, priority badge
//   - Apply .priority-{high|medium|low} class for left border color
//   - Apply .completed class if todo.completed is true
//   - Checkbox onclick: toggle todo.completed, re-render
//   - Title onclick: open edit modal
//   - Delete button (✕): remove todo
//   - Append to todosList
function renderTodos() {
    const project = app.getActiveProject();
    const todosList = document.getElementById('todosList');
    const projectTitle = document.getElementById('projectTitle');
    todosList.innerHTML = '';

    if (!project) {
        projectTitle.textContent = 'No projects';
        todosList.innerHTML = '<p style="color: var(--text-secondary);">Create a project to get started</p>';
        return;
    }

    projectTitle.textContent = project.name;

    // Sort todos: incomplete first, completed at bottom
    const sortedTodos = project.todos.sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;  // incomplete todos come first
    });

    sortedTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item priority-${todo.priority}`;
        if (todo.completed) {
            li.classList.add('completed');
        }

        // Checkbox to mark as complete
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = todo.completed;
        checkbox.style.marginRight = '10px';
        checkbox.onclick = (e) => {
            e.stopPropagation();
            app.updateTodo(todo.id, { completed: !todo.completed });
            render();
        };

        const title = document.createElement('strong');
        title.textContent = todo.title;
        title.style.cursor = 'pointer';
        title.onclick = () => showTodoModal(todo);

        const date = document.createElement('small');
        date.textContent = todo.dueDate || 'No date';

        const priority = document.createElement('span');
        priority.textContent = `[${todo.priority.toUpperCase()}]`;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '✕';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Delete todo "${todo.title}"?`)) {
                app.deleteTodo(todo.id);
                render();
            }
        };

        li.appendChild(checkbox);
        li.appendChild(title);
        li.appendChild(date);
        li.appendChild(priority);
        li.appendChild(deleteBtn);
        todosList.appendChild(li);
    })
}

// ━━━ MASTER RENDER FUNCTION ━━━
// PURPOSE: Single entry point to update entire UI after any data change
// PSEUDO-CODE:
// • Call renderProjects() to update sidebar
// • Call renderTodos() to update main content
// NOTE: Always call this instead of individual renders for consistency
function render() {
    renderProjects();
    renderTodos();
}

// ━━━ SHOW ADD PROJECT MODAL ━━━
// PURPOSE: Display modal dialog to create a new project
// PSEUDO-CODE:
// • Get projectModal element and input field
// • Clear input value and focus cursor
// • On "Create" button click:
//   - Get project name from input
//   - If name is not empty: call app.createProject(name), render UI, close modal
// • On input Enter key: trigger create button click
// • On close button click: hide modal
// • Set modal display to 'flex' to show it
function showAddProjectModal() {
    const modal = document.getElementById('projectModal');
    const input = document.getElementById('projectModalInput');
    const createBtn = document.getElementById('projectModalCreateBtn');
    const closeBtn = document.getElementById('projectModalCloseBtn');

    input.value = '';
    input.focus();

    createBtn.onclick = () => {
        const name = input.value.trim();
        if (name) {
            app.createProject(name);
            render();
            modal.style.display = 'none';
        }
    };

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    input.onkeypress = (e) => {
        if (e.key === 'Enter') {
            createBtn.onclick();
        }
    };

    modal.style.display = 'flex';
}


// ━━━ SHOW ADD TODO MODAL ━━━
// PURPOSE: Display modal dialog to add a new todo to active project
// PSEUDO-CODE:
// • Check if active project exists (alert user if not)
// • Get todoModal and all form input elements
// • Clear all form inputs to empty
// • Set modal title to "Add New Todo"
// • Set button text to "Create Todo"
// • On button click:
//   - Get form values (title, description, dueDate, priority)
//   - If title is not empty: call app.addTodoToActiveProject(...), render UI, close modal
// • On close button click: hide modal
// • Set modal display to 'flex' to show it
function showAddTodoModal() {
    const project = app.getActiveProject();

    if (!project) {
        alert('Please create a project first!');
        return;
    }

    const modal = document.getElementById('todoModal');

    document.getElementById('modalTitle').value = '';
    document.getElementById('modalDescription').value = '';
    document.getElementById('modalDueDate').value = '';
    document.getElementById('modalPriority').value = 'medium';

    modal.querySelector('h3').textContent = 'Add New Todo';
    const updateBtn = document.getElementById('modalUpdateBtn');
    updateBtn.textContent = 'Create Todo';

    updateBtn.onclick = () => {
        const title = document.getElementById('modalTitle').value.trim();
        if (title) {
            app.addTodoToActiveProject(
                title,
                document.getElementById('modalDescription').value,
                document.getElementById('modalDueDate').value,
                document.getElementById('modalPriority').value
            );
            render();
            modal.style.display = 'none';
        }
    };

    document.getElementById('modalClose').onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
}

// ━━━ SHOW EDIT TODO MODAL ━━━
// PURPOSE: Display modal dialog to edit an existing todo
// PSEUDO-CODE:
// • Get todoModal and all form input elements
// • Populate all form fields with todo's current data (title, description, dueDate, priority)
// • Set modal title to "Edit Todo"
// • Set button text to "Update"
// • On button click:
//   - Get form values (may be changed from originals)
//   - Call app.updateTodo(todo.id, {...all updated values}), render UI, close modal
// • On close button click: hide modal
// • Set modal display to 'flex' to show it
function showTodoModal(todo) {
    const modal = document.getElementById('todoModal');

    document.getElementById('modalTitle').value = todo.title;
    document.getElementById('modalDescription').value = todo.description;
    document.getElementById('modalDueDate').value = todo.dueDate;
    document.getElementById('modalPriority').value = todo.priority;


    modal.querySelector('h3').textContent = 'Edit Todo';
    const updateBtn = document.getElementById('modalUpdateBtn');
    updateBtn.textContent = 'Update';


    updateBtn.onclick = () => {
        app.updateTodo(todo.id, {
            title: document.getElementById('modalTitle').value,
            description: document.getElementById('modalDescription').value,
            dueDate: document.getElementById('modalDueDate').value,
            priority: document.getElementById('modalPriority').value
        });
        render();
        modal.style.display = 'none';
    };


    document.getElementById('modalClose').onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
}

// ════════════════════════════════════════════════════════════════════
// SECTION 3: STARTUP & EVENT LISTENERS
// ════════════════════════════════════════════════════════════════════
// 
// INITIALIZATION FLOW ON PAGE LOAD:
// • Wait for DOMContentLoaded event (all HTML loaded)
// • Call app.init() to restore data from localStorage
// • Call render() to display projects and todos
// • Attach click handlers to "New Project" and "New Todo" buttons
// • Attach click handlers to modal backgrounds (close on outside click)
//
// ════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    app.init();


    render();


    document.getElementById('newProjectBtn').onclick = showAddProjectModal;
    document.getElementById('newTodoBtn').onclick = showAddTodoModal;


    document.getElementById('todoModal').addEventListener('click', (e) => {
        if (e.target.id === 'todoModal') {
            e.target.style.display = 'none';
        }
    });

    document.getElementById('projectModal').addEventListener('click', (e) => {
        if (e.target.id === 'projectModal') {
            e.target.style.display = 'none';
        }
    });
});
