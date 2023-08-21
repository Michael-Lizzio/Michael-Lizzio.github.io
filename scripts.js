// Function to fetch and display projects data on the homepage
function fetchProjectsData() {
  return fetch('../data/projects.json')
    .then(response => response.json())
    .then(data => {
      const projectGrid = document.querySelector('.project-grid');

      // Iterate through the projects using Object.entries to get the project objects and their IDs
      Object.entries(data).forEach(([projectId, project]) => {
        const projectCard = document.createElement('div');
        projectCard.classList.add('project-card');
        projectCard.innerHTML = `
          <img src="../data/project_images/${projectId}/${project.images[0]}" alt="${project.title}">
          <h3>${project.title}</h3>
          <a class="read-more-button" href="#">Read More</a>
        `;

        // Add a click event listener to navigate to the project page on click
        projectCard.addEventListener('click', () => {
          navigateToProjectPage(projectId);
        });

        projectGrid.appendChild(projectCard);
      });

      return data; // Return the projects data for later use
    })
    .catch(error => console.error('Error fetching projects JSON:', error));
}


// Fetch and load the projects data, then setup dropdown functionality
fetchProjectsData().then(data => {
  // setupDropdown(data); // If you have setupDropdown, you can use it here
});

// Function to navigate to the project page
function navigateToProjectPage(projectId) {
  // Construct the URL to the specific project page based on the projectId
  const projectPageUrl = `project_pages/${projectId}/${projectId}.html`;

  // Navigate to the project page within the same tab
  window.location.href = projectPageUrl;
}
