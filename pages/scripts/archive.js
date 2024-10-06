document.addEventListener("DOMContentLoaded", () => {
    fetch('../../data/archive.json')
        .then(response => response.json())
        .then(projectsJson => {
            const headDictDesktop = {
                "Year": "date--year",
                "Project": "name",
                "Description": "description",
                "Project Type": "type",
                "Made with": "made_with",
                "Link": "link"
            };

            const headDictMobile = {
                "Year": "date--year-short",
                "Project": "name",
                "Project Type": "type",
                "Link": "link"
            };

            const projectArchiveDesktop = document.getElementById("project-archive");
            const projectArchiveMobile = document.getElementById("project-archive-mobile");

            // Function to format date based on format string
            const formatDate = (dateStr, format) => {
                const date = new Date(dateStr);
                const year = date.getFullYear();
                const yearShort = year.toString().slice(-2);
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');

                return format
                    .replace("year-short", yearShort)
                    .replace("year", year)
                    .replace("month", month)
                    .replace("day", day)
                    .replace(/\|/g, "/")
                    .replace(/-/g, "-")
                    .replace("date--", "");
            };

            // Function to load projects as table
            const loadProjectsTable = (archiveElement, headDict, projects) => {
                const table = document.createElement('table');
                table.classList.add('project-table');

                // Create table header
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                Object.keys(headDict).forEach(header => {
                    const th = document.createElement('th');
                    th.textContent = header;
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);

                // Create table body
                const tbody = document.createElement('tbody');
                projects.forEach(project => {
                    const row = document.createElement('tr');
                    Object.values(headDict).forEach(key => {
                        const td = document.createElement('td');
                        if (key.startsWith("date--")) {
                            td.textContent = formatDate(project.date, key);
                        } else if (key === "made_with") {
                            td.textContent = project.made_with.join(", ");
                        } else if (key === "link") {
                            const linkElement = document.createElement("a");
                            linkElement.href = project.link;
                            linkElement.target = "_blank";
                            linkElement.textContent = "View Project";
                            td.appendChild(linkElement);
                        } else {
                            td.textContent = project[key];
                        }
                        row.appendChild(td);
                    });
                    tbody.appendChild(row);
                });
                table.appendChild(tbody);

                // Append table to the archive element
                archiveElement.innerHTML = ''; // Clear previous content
                archiveElement.appendChild(table);
            };

            // Initial load
            loadProjectsTable(projectArchiveDesktop, headDictDesktop, projectsJson.projects);
            loadProjectsTable(projectArchiveMobile, headDictMobile, projectsJson.projects);

            // Function to handle layout visibility for mobile vs. desktop
            const handleResize = () => {
                const isMobile = window.innerWidth <= 768;
                projectArchiveDesktop.style.display = isMobile ? 'none' : 'block';
                projectArchiveMobile.style.display = isMobile ? 'block' : 'none';
            };

            window.addEventListener("resize", handleResize);
            handleResize(); // Initial check

            // Add theme options dynamically
            const themes = [
                { name: "Default", class: "" },
                { name: "Slate Gray", class: "theme-slate-gray" },
                { name: "Solarized Light", class: "theme-solarized-light" },
                { name: "Solarized Dark", class: "theme-solarized-dark" },
                { name: "Monokai", class: "theme-monokai" },
                { name: "Dracula", class: "theme-dracula" },
                { name: "Material Light", class: "theme-material-light" },
                { name: "Material Dark", class: "theme-material-dark" },
                { name: "High Contrast", class: "theme-high-contrast" },
                { name: "Pastel Dreams", class: "theme-pastel-dreams" },
                { name: "Earth Tones", class: "theme-earth-tones" },
                { name: "Retro Neon", class: "theme-retro-neon" },
                { name: "Forest Green", class: "theme-forest-green" },
                { name: "Ocean Blue", class: "theme-ocean-blue" },
                { name: "Sunset Orange", class: "theme-sunset-orange" },
                { name: "Lavender", class: "theme-lavender" },
                { name: "Coral Reef", class: "theme-coral-reef" },
                { name: "Royal Purple", class: "theme-royal-purple" },
                { name: "Golden Glow", class: "theme-golden-glow" },
                { name: "Midnight Red", class: "theme-midnight-red" },
                { name: "Arctic Ice", class: "theme-arctic-ice" },
                { name: "Pink Blossom", class: "theme-pink-blossom" },
                { name: "Autumn Maple", class: "theme-autumn-maple" },
                { name: "Cherry Blossom", class: "theme-cherry-blossom" },
                { name: "Cool Mint", class: "theme-cool-mint" },
                { name: "Amber Glow", class: "theme-amber-glow" },
                { name: "Slate Blue", class: "theme-slate-blue" },
                { name: "Raspberry Red", class: "theme-raspberry-red" },
                { name: "Denim Blue", class: "theme-denim-blue" },
                { name: "Cobalt Teal", class: "theme-cobalt-teal" },
                { name: "Royal Emerald", class: "theme-royal-emerald" }
            ];

            const themeSelector = document.getElementById('theme-selector');
            const randomizeButton = document.getElementById('randomize-button');

            // Populate the theme selector dropdown
            themes.forEach(theme => {
                const option = document.createElement('option');
                option.value = theme.class;
                option.textContent = theme.name;
                themeSelector.appendChild(option);
            });

            // Handle theme changes
            themeSelector.addEventListener('change', function() {
                changeTheme(this.value);
            });

            // Handle randomize button click
            randomizeButton.addEventListener('click', () => {
                const randomTheme = themes[Math.floor(Math.random() * themes.length)];
                themeSelector.value = randomTheme.class;
                changeTheme(randomTheme.class);
            });

            // Function to change the theme
            function changeTheme(theme) {
                // Remove all existing theme classes from the body
                document.body.className = '';

                // Apply the selected theme class if it's not empty
                if (theme) {
                    document.body.classList.add(theme);
                }
            }
        })
        .catch(error => console.error('Error loading the projects JSON file:', error));
});
