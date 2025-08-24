document.addEventListener("DOMContentLoaded", () => {
  fetch("navbar.html")
    .then((response) => response.text())
    .then((data) => {
      document.getElementById("navbar").innerHTML = data;
      addEventListeners();
      toggleTheme();
      const themeData = window.electronData.data;

      document.getElementById("versionNum").innerHTML =
        themeData.versionNo === undefined ? "" : themeData.versionNo;

        document.getElementById("versionNumMenu").innerHTML =
        themeData.versionNo === undefined ? "" : themeData.versionNo;

      if (themeData.theme === "dark") {
        document
          .getElementById("themeToggle")
          .dispatchEvent(new Event("change"));
      }
    })
    .catch((error) => console.error("Error in loadNavbar.js at navbar loading: Error loading navbar:", error));
});

function toggleTheme() {
  const toggle = document.getElementById("themeToggle");
  const body = document.body;
  const sunIcon = document.getElementById("sunIcon");
  const moonIcon = document.getElementById("moonIcon");
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
    sunIcon.classList.replace(sunFrom, sunTo);

    const moonFrom = isDarkMode ? "bi-moon" : "bi-moon-fill";
    const moonTo = isDarkMode ? "bi-moon-fill" : "bi-moon";
    moonIcon.classList.replace(moonFrom, moonTo);

    // update groups of classes by iterating over pairs
    classPairs.forEach(([lightClass, darkClass]) => {
      const from = isDarkMode ? lightClass : darkClass;
      const to = isDarkMode ? darkClass : lightClass;
      toggleClasses(document.getElementsByClassName(from), from, to);
    });

    const theme = isDarkMode ? "dark" : "light";
    window.ipcRenderer.send("save-theme", theme);
  });
}

function addEventListeners() {
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
    { id: "get-playlists", event: "click", handler: (e) => {
      e.preventDefault();
      getPlaylist();
    }},
  ];

  events.forEach(({ id, event, handler }) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handler);
    }
  });
}

function navigateTo(destination) {
  window.ipcRenderer.send("navigate-to", destination);
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
  ];

  displayMessage("progressbar", "block");

  try {
    const result = await window.ipcRenderer.invoke("save-config", data);
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
    console.error("Error testing connection:", error);
    displayMessage("progressbar", "none");
    displayMessage(
      "test-result-fail",
      "block",
      "Connection Error!!! <br/> Please check your settings and try again."
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
    const result = await window.ipcRenderer.invoke("create-m3u-playlist", [
      document.getElementById("mthreeuPath").value.replace(/['"]+/g, "").trim(),
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
    const result = await window.ipcRenderer.invoke("create-playlist", [
      document.getElementById("folderPath").value.replace(/['"]+/g, "").trim(),
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
    const result = await window.ipcRenderer.invoke(
      "bulk-playlist",
      jsonInput.value
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
    const result = await window.ipcRenderer.invoke("test-connection");
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
        `Connection Successful!!! <br/>
        Plex Server Name: ${result.MediaContainer.friendlyName} <br/>
        Plex User Name: ${result.MediaContainer.myPlexUsername} <br/>
        Plex Platform: ${result.MediaContainer.platform} <br/>
        Plex Platform Version: ${result.MediaContainer.platformVersion} <br/>
        Plex Software Version: ${result.MediaContainer.version}`
      );
      console.log(result);
    }
  } catch (error) {
    console.error("Error testing connection:", error);
    displayMessage("progressbar", "none");
  }
}

async function getVersion(e) {
  e.preventDefault();
  try {
    await window.ipcRenderer.invoke("releaseVersion");
  } catch (error) {
    console.error("Error deleting playlist:", error);
  }
}

async function deleteAllPlaylist() {
  displayMessage("test-result-fail", "none", "none");
  displayMessage("test-result", "none", "none");

  const parameters = [];
  const response = await window.ipcRenderer.invoke("openDialog", parameters);

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
    const result = await window.ipcRenderer.invoke("delete-all-playlist");
    displayMessage("progressbar", "none");

    if (!result) {
      displayMessage(
        "test-result-fail",
        "block",
        `Error Playlists cannot be deleted <br/>`
      );
    } else {
      displayMessage(
        "test-result",
        "block",
        `Playlists deleted successfully!! <br/>`
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
  const response = await window.ipcRenderer.invoke("openDialog", parameters);

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
    const result = await window.ipcRenderer.invoke(
      "delete-playlist",
      playlistId
    );
    displayMessage("progressbar", "none");

    if (!result) {
      displayMessage(
        "test-result-fail",
        "block",
        `Error Playlist No: [${playlist_no}] Name: [${playlist_name}] and Id: [${playlistId}] cannot be deleted <br/>`
      );
    } else {
      rowid.remove();
      displayMessage(
        "test-result",
        "block",
        `Playlist No: [${playlist_no}] Name: [${playlist_name}] and Id: [${playlistId}] deleted successfully!! <br/>`
      );
      getPlaylist( `Playlist No: [${playlist_no}] Name: [${playlist_name}] and Id: [${playlistId}] deleted successfully!!`);
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
    const result = await window.ipcRenderer.invoke("get-playlists");
    displayMessage("progressbar", "none");

    if (result === false) {
      displayMessage(
        "test-result-fail",
        "block",
        "Connection Error!!! <br/> Please check your settings and try again."
      );
    } else {
      const successMessage = `${additionalMessage ? "" + additionalMessage+"<br/>": " "}  ${result.length}&#8198;Playlists retrieved successfully!!!`;
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
    const result = await window.ipcRenderer.invoke("refresh-playlists");
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
        "Playlists refreshed successfully!!! <br/>"
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
    const result = await window.ipcRenderer.invoke("recent-played-playlists");
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
      getPlaylist( "Playlists Recently Played Created successfully!!!");
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
    const result = await window.ipcRenderer.invoke("recent-added-playlists");
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

  window.ipcRenderer.invoke('delete-selected-playlists', selectedIds)
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
