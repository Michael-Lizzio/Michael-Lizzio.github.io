// Select all boxes
const boxes = document.querySelectorAll('.box');

// Function to move the box away from the mouse
function moveAway(event) {
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    boxes.forEach(box => {
        const boxRect = box.getBoundingClientRect();
        const boxX = boxRect.left + boxRect.width / 2;
        const boxY = boxRect.top + boxRect.height / 2;

        const deltaX = boxX - mouseX;
        const deltaY = boxY - mouseY;

        // Calculate distance from the mouse to the center of the box
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // If the mouse is too close, move the box away
        if (distance < 150) {
            const moveX = deltaX * 0.5; // Adjust the multiplier to change the speed of movement
            const moveY = deltaY * 0.5;

            // Calculate the new position of the box
            let newLeft = boxRect.left + moveX;
            let newTop = boxRect.top + moveY;

            // Ensure the new position stays within the window bounds
            const maxLeft = window.innerWidth - boxRect.width;
            const maxTop = window.innerHeight - boxRect.height;

            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));

            // Update box position using left and top properties
            box.style.left = `${newLeft}px`;
            box.style.top = `${newTop}px`;
        }
    });
}

// Initialize positions of boxes
boxes.forEach(box => {
    box.style.position = 'absolute';
    box.style.left = `${Math.random() * (window.innerWidth - box.offsetWidth)}px`;
    box.style.top = `${Math.random() * (window.innerHeight - box.offsetHeight)}px`;
});

// Add event listener for mouse movement
document.addEventListener('mousemove', moveAway);
