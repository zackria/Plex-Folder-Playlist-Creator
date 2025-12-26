document.addEventListener("DOMContentLoaded", () => {
  // Check global console logging configuration
  if (globalThis.electronData?.data?.enableConsole === "false") {
    const noop = () => { };
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.debug = noop;
  }

  // Bind page listeners immediately
  addEventListeners();

  fetch("navbar.html")
    .then((response) => response.text())
    .then((data) => {
      document.getElementById("navbar").innerHTML = data;
      // Bind navbar listeners
      addEventListeners();
      toggleTheme();

      if (globalThis.electronData?.data) {
        const themeData = globalThis.electronData.data;
        document.getElementById("versionNum").innerHTML =
          themeData.versionNo === undefined ? "" : themeData.versionNo;

        if (document.getElementById("versionNumMenu")) {
          document.getElementById("versionNumMenu").innerHTML =
            themeData.versionNo === undefined ? "" : themeData.versionNo;
        }

        if (themeData.theme === "dark") {
          const toggle = document.getElementById("themeToggle");
          if (toggle) toggle.dispatchEvent(new Event("change"));
        }
      }
      // Enforce numeric-only input for port and timeout fields
      makeNumeric('port');
      makeNumeric('timeout');
    })
    .catch((error) => console.error("Error in loadNavbar.js at navbar loading: Error loading navbar:", error));
});


function makeNumeric(id) {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener("input", (e) => {
      e.target.value = e.target.value.replaceAll(/\D/g, "");
    });
  }
}

function toggleTheme() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  const body = document.body;
  const sunIcon = document.getElementById("sunIcon");
  const moonIcon = document.getElementById("moonIcon");
  // ... logic
  const toggleClasses = (elements, fromClass, toClass) => {
    Array.from(elements).forEach((el) => el.classList.replace(fromClass, toClass));
  };

  const classPairs = [
    ["table-light", "table-dark"],
    ["text-dark", "text-light"],
    ["bg-light", "bg-dark"],
    ["navbar-light", "navbar-dark"],
  ];

  toggle.addEventListener("change", () => {
    const isDarkMode = body.classList.toggle("bg-dark");

    // swap sun and moon icons
    const sunFrom = isDarkMode ? "bi-sun-fill" : "bi-sun";
    const sunTo = isDarkMode ? "bi-sun" : "bi-sun-fill";
    if (sunIcon) sunIcon.classList.replace(sunFrom, sunTo);

    const moonFrom = isDarkMode ? "bi-moon" : "bi-moon-fill";
    const moonTo = isDarkMode ? "bi-moon-fill" : "bi-moon";
    if (moonIcon) moonIcon.classList.replace(moonFrom, moonTo);

    // update groups of classes by iterating over pairs
    classPairs.forEach(([lightClass, darkClass]) => {
      const from = isDarkMode ? lightClass : darkClass;
      const to = isDarkMode ? darkClass : lightClass;
      toggleClasses(document.getElementsByClassName(from), from, to);
    });

    const theme = isDarkMode ? "dark" : "light";
    globalThis.ipcRenderer.send("save-theme", theme);
  });
}

function addEventListeners() {
  console.log("Adding event listeners...");
  const events = [
    {
      id: "go-to-actions",
      event: "click",
      handler: () => navigateTo("actions"),
    },
    {
      id: "go-to-action",
      event: "click",
      handler: () => navigateTo("actions"),
    },
    { id: "go-to-config", event: "click", handler: () => navigateTo("index") },
    { id: "go-toconfig", event: "click", handler: () => navigateTo("index") },
    {
      id: "go-to-create-playlist",
      event: "click",
      handler: () => navigateTo("createplaylist"),
    },
    {
      id: "go-to-bulk-playlist",
      event: "click",
      handler: () => navigateTo("bulkplaylist"),
    },
    {
      id: "go-to-version-number",
      event: "click",
      handler: (e) => getVersion(e),
    },
    {
      id: "go-to-m3u",
      event: "click",
      handler: () => navigateTo("m3uplaylist"),
    },
    { id: "config-form", event: "submit", handler: handleFormSubmit },
    { id: "playlist-form", event: "submit", handler: handlePlaylistFormSubmit },
    {
      id: "bulk-playlist-form",
      event: "submit",
      handler: handleBulkPlaylistFormSubmit,
    },
    {
      id: "mthreeuplaylist-form",
      event: "submit",
      handler: handleM3UPlaylistFormSubmit,
    },
    { id: "test-connection", event: "click", handler: testConnection },
    { id: "refresh-playlists", event: "click", handler: refreshPlaylist },
    { id: "recent-played-playlists", event: "click", handler: recentPlayedPlaylist },
    { id: "recent-added-playlists", event: "click", handler: recentAddedPlaylist },
    {
      id: "get-playlists", event: "click", handler: (e) => {
        e.preventDefault();
        getPlaylist();
      }
    },
  ];

  events.forEach(({ id, event, handler }) => {
    const element = document.getElementById(id);
    // Only attach if element exists and hasn't been attached yet
    if (element && !element.dataset.listenerAttached) {
      console.log(`Attaching listener to ${id}`);
      element.addEventListener(event, handler);
      element.dataset.listenerAttached = "true";
    }
  });
}


function navigateTo(destination) {
  globalThis.ipcRenderer.send("navigate-to", destination);
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById("config-form");

  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    displayMessage("test-result-fail", "none", "none");
    return;
  }

  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");

  form.classList.add("was-validated");
  const data = [
    document.getElementById("apiKey").value,
    document.getElementById("ipAddress").value,
    document.getElementById("port").value,
    // include timeout input so backend receives UI value (may be a string)
    (document.getElementById("timeout") ? document.getElementById("timeout").value.trim() : undefined),
  ];

  displayMessage("progressbar", "block");

  try {
    const result = await globalThis.ipcRenderer.invoke("save-config", data);
    displayMessage("progressbar", "none");

    if (result === false) {
      displayMessage(
        "test-result-fail",
        "block",
        "Connection Error!!! <br/> Please check your settings and try again."
      );
    } else {
      displayMessage(
        "test-result",
        "block",
        "Configuration Saved Successfully !!! <br/>"
      );
    }
  } catch (error) {
    console.error("Error saving config:", error);
    displayMessage("progressbar", "none");
    displayMessage(
      "test-result-fail",
      "block",
      `Connection Error!!! <br/> ${error.message || "Unknown error"}`
    );
  }
}

async function handleM3UPlaylistFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById("mthreeuplaylist-form");

  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");
  form.classList.add("was-validated");
  displayMessage("progressbar", "block");

  try {
    const result = await globalThis.ipcRenderer.invoke("create-m3u-playlist", [
      document.getElementById("mthreeuPath").value.replaceAll(/['"]+/g, "").trim(),
      document.getElementById("library").value.trim(),
    ]);
    displayMessage("progressbar", "none");

    if (result.status === "error") {
      displayMessage(
        "test-result-fail",
        "block",
        "Playlist not created !!! <br/>" + result.message
      );
    } else {
      displayMessage("test-result", "block", result.message);
    }
  } catch (error) {
    console.error("Error testing connection:", error);
    displayMessage("progressbar", "none");
    displayMessage(
      "test-result-fail",
      "block",
      "Playlist not created !!! <br/> Please check your folder path & connection settings and try again."
    );
  }
}

async function handlePlaylistFormSubmit(e) {
  e.preventDefault();
  const form = document.getElementById("playlist-form");

  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }
  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");
  form.classList.add("was-validated");
  displayMessage("progressbar", "block");

  try {
    const result = await globalThis.ipcRenderer.invoke("create-playlist", [
      document.getElementById("folderPath").value.replaceAll(/['"]+/g, "").trim(),
      document.getElementById("playlistName").value.trim(),
      document.getElementById("library").value.trim(),
    ]);
    displayMessage("progressbar", "none");

    if (result.status === "error") {
      displayMessage(
        "test-result-fail",
        "block",
        "Playlist not created !!! <br/>" + result.message
      );
    } else {
      displayMessage("test-result", "block", result.message);
    }
  } catch (error) {
    console.error("Error testing connection:", error);
    displayMessage("progressbar", "none");
    displayMessage(
      "test-result-fail",
      "block",
      "Playlist not created !!! <br/> Please check your folder path & connection settings and try again."
    );
  }
}

async function handleBulkPlaylistFormSubmit(e) {
  e.preventDefault();

  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");

  const form = document.getElementById("bulk-playlist-form");
  const jsonInput = document.getElementById("folderPath");
  const feedback = document.getElementById("feedbackDynamic");

  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  try {
    JSON.parse(jsonInput.value);
    feedback.textContent = "Valid JSON!";
    feedback.classList.replace("alert-danger", "alert-success");
    feedback.style.display = "block";
  } catch (error) {
    feedback.textContent = "Invalid JSON: " + error.message;
    feedback.classList.replace("alert-success", "alert-danger");
    feedback.style.display = "block";
    return;
  }

  form.classList.add("was-validated");
  displayMessage("progressbar", "block");

  try {
    const result = await globalThis.ipcRenderer.invoke(
      "bulk-playlist",
      [
        jsonInput.value,
        document.getElementById("library").value.trim() || "Music"
      ]
    );
    displayMessage("progressbar", "none");

    if (result.status === "error") {
      displayMessage(
        "test-result-fail",
        "block",
        "Error!!! <br/> Please check your settings and try again.<br/> " +
        result.message
      );
    } else {
      displayMessage("test-result", "block", result.message);
    }
  } catch (error) {
    console.error("Error testing connection:", error);
    displayMessage("progressbar", "none");
    displayMessage(
      "test-result-fail",
      "block",
      "Connection Error!!! <br/> Please check your settings and try again."
    );
  }
}

async function testConnection() {
  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");
  displayMessage("progressbar", "block");

  try {
    const result = await globalThis.ipcRenderer.invoke("test-connection");
    displayMessage("progressbar", "none");

    // Backwards compatible handling: some callers may still get `false`.
    if (result === false) {
      displayMessage(
        "test-result-fail",
        "block",
        "Connection Error!!! <br/> Please check your settings and try again."
      );
      return;
    }

    // New structured response: { success: true, data } or { success: false, error }
    if (result && typeof result === "object") {
      if (result.success) {
        const info = result.data?.MediaContainer ?? {};
        displayMessage(
          "test-result",
          "block",
          `Connection Successful!!! <br/>
        Plex Server Name: ${info.friendlyName || "(unknown)"} <br/>
        Plex User Name: ${info.myPlexUsername || "(unknown)"} <br/>
        Plex Platform: ${info.platform || "(unknown)"} <br/>
        Plex Platform Version: ${info.platformVersion || "(unknown)"} <br/>
        Plex Software Version: ${info.version || "(unknown)"}`
        );
      } else {
        // result.success === false
        const err = result.error || {};
        const statusLine = err.statusCode ? `Status: ${err.statusCode} <br/>` : "";
        displayMessage(
          "test-result-fail",
          "block",
          `Connection Error!!! <br/> ${statusLine} ${err.name || ""}: ${err.message || "Unknown error"}`
        );
        console.error("Detailed connection error:", err);
      }
    } else {
      // Unexpected shape — show generic error
      displayMessage(
        "test-result-fail",
        "block",
        "Connection Error!!! <br/> Please check your settings and try again."
      );
    }
  } catch (error) {
    console.error("Error testing connection:", error);
    displayMessage("progressbar", "none");
  }
}

async function getVersion(e) {
  e.preventDefault();
  try {
    await globalThis.ipcRenderer.invoke("releaseVersion");
  } catch (error) {
    console.error("Error deleting playlist:", error);
  }
}

async function deleteAllPlaylist() {
  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");

  const parameters = [];
  const response = await globalThis.ipcRenderer.invoke("openDialog", parameters);

  if (!response) {
    displayMessage(
      "test-result-fail",
      "block",
      `Delete All Playlist is cancelled <br/>`
    );

    return;
  }

  displayMessage("progressbar", "block");

  try {
    const result = await globalThis.ipcRenderer.invoke("delete-all-playlist");
    displayMessage("progressbar", "none");

    if (result) {
      displayMessage(
        "test-result",
        "block",
        `Playlists deleted successfully!! <br/>`
      );
    } else {
      displayMessage(
        "test-result-fail",
        "block",
        `Error Playlists cannot be deleted <br/>`
      );
    }

    getPlaylist("Playlists deleted successfully!! ");
  } catch (error) {
    console.error("Error deleting playlist:", error);
    displayMessage("progressbar", "none");
    displayMessage(
      "test-result-fail",
      "block",
      `Error Playlists cannot be deleted <br/>`
    );
  }
}

async function deletePlaylist(rowid, playlistId) {
  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");

  const playlist_no = rowid.cells[1].textContent; // Index column (cell 1)
  const playlist_name = rowid.cells[2].textContent; // Title column (cell 2)
  const parameters = [playlist_no, playlistId, playlist_name];
  const response = await globalThis.ipcRenderer.invoke("openDialog", parameters);

  if (!response) {
    displayMessage(
      "test-result-fail",
      "block",
      `Delete Playlist No: [${playlist_no}] Name: [${playlist_name}] and Id: [${playlistId}] cancelled <br/>`
    );

    return;
  }

  const nonDeletablePlaylists = [
    "All Music",
    "Recently Added",
    "Recently Played",
    "Tracks",
    "❤️ Tracks",
  ];
  if (nonDeletablePlaylists.includes(playlist_name)) {
    displayMessage(
      "test-result-fail",
      "block",
      `Error Playlist No: [${playlist_no}] Name: [${playlist_name}] and Id: [${playlistId}] cannot be deleted <br/>`
    );
    return;
  }

  displayMessage("progressbar", "block");

  try {
    const result = await globalThis.ipcRenderer.invoke(
      "delete-playlist",
      playlistId
    );
    displayMessage("progressbar", "none");

    if (result) {
      rowid.remove();
      displayMessage(
        "test-result",
        "block",
        `Playlist No: [${playlist_no}] Name: [${playlist_name}] and Id: [${playlistId}] deleted successfully!! <br/>`
      );
      getPlaylist(`Playlist No: [${playlist_no}] Name: [${playlist_name}] and Id: [${playlistId}] deleted successfully!!`);
    } else {
      displayMessage(
        "test-result-fail",
        "block",
        `Error Playlist No: [${playlist_no}] Name: [${playlist_name}] and Id: [${playlistId}] cannot be deleted <br/>`
      );
    }
  } catch (error) {
    console.error("Error deleting playlist:", error);
    displayMessage("progressbar", "none");
    displayMessage(
      "test-result-fail",
      "block",
      `Error Playlist No: [${playlist_no}] Name: [${playlist_name}] and Id: [${playlistId}] cannot be deleted <br/>`
    );
  }
}

async function getPlaylist(additionalMessage) {
  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");
  displayMessage("progressbar", "block");

  try {
    const result = await globalThis.ipcRenderer.invoke("get-playlists");
    displayMessage("progressbar", "none");

    if (result === false) {
      displayMessage(
        "test-result-fail",
        "block",
        "Connection Error!!! <br/> Please check your settings and try again."
      );
    } else {
      const successMessage = `${additionalMessage ? "" + additionalMessage + "<br/>" : " "}  ${result.length}&#8198;Playlists retrieved successfully!!!`;
      displayMessage(
        "test-result",
        "block",
        successMessage
      );
      populateTable(result);
    }
  } catch (error) {
    console.error("Error getting playlists:", error);
    displayMessage("progressbar", "none");
    displayMessage(
      "test-result-fail",
      "block",
      "Connection Error!!! <br/> Please check your settings and try again."
    );
  }
}

async function refreshPlaylist() {
  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");
  displayMessage("progressbar", "block");

  try {
    const libraryElement = document.getElementById("library");
    const libraryName = libraryElement ? libraryElement.value.trim() : "";

    const result = await globalThis.ipcRenderer.invoke("refresh-playlists", libraryName);
    displayMessage("progressbar", "none");

    if (result === false) {
      displayMessage(
        "test-result-fail",
        "block",
        "Connection Error!!! <br/> Please check your settings and try again."
      );
    } else {
      const msg = libraryName
        ? `Library "${libraryName}" refreshed successfully!!! <br/>`
        : "All libraries refreshed successfully!!! <br/>";
      displayMessage(
        "test-result",
        "block",
        msg
      );
    }
  } catch (error) {
    console.error("Error refreshing playlists:", error);
    displayMessage("progressbar", "none");
    displayMessage(
      "test-result-fail",
      "block",
      "Connection Error!!! <br/> Please check your settings and try again."
    );
  }
}



async function recentPlayedPlaylist() {
  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");
  displayMessage("progressbar", "block");

  try {
    const result = await globalThis.ipcRenderer.invoke("recent-played-playlists");
    displayMessage("progressbar", "none");

    if (result === false) {
      displayMessage(
        "test-result-fail",
        "block",
        "Connection Error!!! <br/> Please check your settings and try again."
      );
    } else {
      displayMessage(
        "test-result",
        "block",
        "Playlists Recently Played Created successfully!!! <br/>"
      );
      getPlaylist("Playlists Recently Played Created successfully!!!");
    }
  } catch (error) {
    console.error("Error refreshing playlists:", error);
    displayMessage("progressbar", "none");
    displayMessage(
      "test-result-fail",
      "block",
      "Connection Error!!! <br/> Please check your settings and try again."
    );
  }
}


async function recentAddedPlaylist() {
  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");
  displayMessage("progressbar", "block");

  try {
    const result = await globalThis.ipcRenderer.invoke("recent-added-playlists");
    displayMessage("progressbar", "none");

    if (result === false) {
      displayMessage(
        "test-result-fail",
        "block",
        "Connection Error!!! <br/> Please check your settings and try again."
      );
    } else {
      displayMessage(
        "test-result",
        "block",
        "Playlists Recently Added Created successfully!!! <br/>"
      );
      getPlaylist("Playlists Recently Added Created successfully!!!");

    }
  } catch (error) {
    console.error("Error refreshing playlists:", error);
    displayMessage("progressbar", "none");
    displayMessage(
      "test-result-fail",
      "block",
      "Connection Error!!! <br/> Please check your settings and try again."
    );
  }
}

function filterTable() {
  const input = document.getElementById("searchInput");
  const filter = input.value.toLowerCase();
  const table = document.getElementById("dataTable");
  const rows = table.getElementsByTagName("tr");

  for (let i = 1; i < rows.length; i++) { // Start from 1 to skip the header row
    const row = rows[i];
    const cells = row.getElementsByTagName("td");
    let match = false;

    for (const cell of cells) {
      if (cell?.innerText?.toLowerCase().includes(filter)) {
        match = true;
        break;
      }
    }

    row.style.display = match ? "" : "none";
  }
}

function populateTable(data) {
  const tableBody = document.querySelector('#dataTable tbody');
  tableBody.innerHTML = ''; // Clear existing rows

  data.forEach((playlist, index) => {
    const row = document.createElement('tr');

    // Checkbox column
    const checkboxCell = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.id = playlist.ratingKey; // Use ratingKey for Playlist ID
    checkbox.className = 'form-check-input'; // Add Bootstrap class for styling
    checkbox.style.display = 'inline-block'; // Force visibility
    checkboxCell.appendChild(checkbox);
    row.appendChild(checkboxCell);

    // Index column
    const indexCell = document.createElement('td');
    indexCell.textContent = index + 1;
    row.appendChild(indexCell);

    // Title column
    const titleCell = document.createElement('td');
    titleCell.textContent = playlist.title || 'Unknown'; // Fallback to 'Unknown' if title is missing
    row.appendChild(titleCell);

    // Playlist ID column
    const idCell = document.createElement('td');
    idCell.textContent = playlist.ratingKey || 'N/A'; // Fallback to 'N/A' if ratingKey is missing
    row.appendChild(idCell);

    // Delete button column
    const deleteCell = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'btn btn-primary btn-sm';
    deleteButton.onclick = () => deletePlaylist(row, playlist.ratingKey);
    deleteCell.appendChild(deleteButton);
    row.appendChild(deleteCell);

    tableBody.appendChild(row);
  });

  // Setup select all functionality after table is populated
  setupSelectAllFunctionality();
}

function setupSelectAllFunctionality() {
  const selectAllCheckbox = document.getElementById('select-all');
  const deleteSelectedButton = document.getElementById('delete-selected');

  if (selectAllCheckbox) {
    // Remove any existing event listeners to avoid duplicates
    selectAllCheckbox.removeEventListener('change', handleSelectAll);
    selectAllCheckbox.addEventListener('change', handleSelectAll);
  }

  if (deleteSelectedButton) {
    // Remove any existing event listeners to avoid duplicates
    deleteSelectedButton.removeEventListener('click', handleDeleteSelected);
    deleteSelectedButton.addEventListener('click', handleDeleteSelected);
  }
}

function handleSelectAll() {
  const selectAllCheckbox = document.getElementById('select-all');
  const checkboxes = document.querySelectorAll('#dataTable tbody input[type="checkbox"]');
  checkboxes.forEach(checkbox => checkbox.checked = selectAllCheckbox.checked);
}

function handleDeleteSelected() {
  const selectedIds = Array.from(document.querySelectorAll('#dataTable tbody input[type="checkbox"]:checked'))
    .map(checkbox => checkbox.dataset.id);
  deleteSelectedPlaylists(selectedIds);
}

function deleteSelectedPlaylists(selectedIds) {
  if (selectedIds.length === 0) {
    alert('No playlists selected.');
    return;
  }

  // Show confirmation dialog for bulk delete
  const confirmDelete = confirm(`Are you sure you want to delete ${selectedIds.length} selected playlist(s)?`);
  if (!confirmDelete) {
    displayMessage(
      "test-result-fail",
      "block",
      `Delete Selected Playlists cancelled <br/>`
    );
    return;
  }

  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");
  displayMessage("progressbar", "block");

  globalThis.ipcRenderer.invoke('delete-selected-playlists', selectedIds)
    .then(response => {
      displayMessage("progressbar", "none");
      if (response.success) {
        displayMessage(
          "test-result",
          "block",
          `${selectedIds.length} selected playlists deleted successfully!! <br/>`
        );
        const tableBody = document.querySelector('#dataTable tbody');
        tableBody.innerHTML = ''; // Clear the table body explicitly
        getPlaylist(`${selectedIds.length} selected playlists deleted successfully!!`); // Reload and populate the table
      } else {
        displayMessage(
          "test-result-fail",
          "block",
          `Failed to delete playlists: ${response.message || 'Unknown error'} <br/>`
        );
      }
    })
    .catch(error => {
      console.error('Error deleting selected playlists:', error);
      displayMessage("progressbar", "none");
      displayMessage(
        "test-result-fail",
        "block",
        "Error occurred while deleting playlists. <br/>"
      );
    });
}

function displayMessage(elementId, displayStyle, message = "") {
  const element = document.getElementById(elementId);
  element.style.display = displayStyle;
  if (message) {
    element.innerHTML = message;
  }
}
