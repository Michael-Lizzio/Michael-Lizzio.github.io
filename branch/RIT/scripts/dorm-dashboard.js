document.addEventListener("DOMContentLoaded", loadLogs);

function loadLogs() {
    const logEntries = [
        
    ];

    const logEntriesContainer = document.getElementById("log-entries");

    logEntries.forEach(entry => {
        const row = document.createElement("tr");

        const actionCell = document.createElement("td");
        actionCell.textContent = entry.action;

        const notesCell = document.createElement("td");
        notesCell.textContent = entry.notes;

        const timeCell = document.createElement("td");
        timeCell.textContent = entry.time;

        row.appendChild(actionCell);
        row.appendChild(notesCell);
        row.appendChild(timeCell);

        logEntriesContainer.appendChild(row);
    });
}

function toggleLights(state) {
    // Code to handle light toggling
    console.log(`Lights turned ${state}`);
}

function setTemperature() {
    const setTemp = document.getElementById("set-temp").value;
    console.log(`Temperature set to ${setTemp}`);
}

function downloadLog() {
    // Function to download the log as a CSV or JSON file
    console.log("Download log triggered");
}

function loadMoreLogs() {
    // Function to load more logs (e.g., from a server or additional JSON)
    console.log("Load more logs triggered");
}
