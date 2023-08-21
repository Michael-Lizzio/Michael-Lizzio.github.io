function isInViewport(element) {
  const bounding = element.getBoundingClientRect();
  return (
    bounding.top >= 0 &&
    bounding.left >= 0 &&
    bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

function handleScroll() {
  const imageBoxes = document.querySelectorAll('.image-box');
  imageBoxes.forEach((box) => {
    if (isInViewport(box)) {
      box.classList.add('in-view');
    } else {
      box.classList.remove('in-view');
    }
  });
}

// Add the scroll event listener
window.addEventListener('scroll', handleScroll);

// Trigger the scroll event on page load
window.dispatchEvent(new Event('scroll'));


// JavaScript for the image board grid section
const images = document.querySelectorAll('.image-with-date img');

images.forEach(image => {
    image.addEventListener('click', () => {
        image.classList.toggle('full-screen');
        if (image.classList.contains('full-screen')) {
            document.addEventListener('keydown', exitFullScreenOnEsc);
        } else {
            document.removeEventListener('keydown', exitFullScreenOnEsc);
        }
    });
});

function exitFullScreenOnEsc(event) {
    if (event.key === 'Escape') {
        const fullScreenImage = document.querySelector('.image-with-date img.full-screen');
        if (fullScreenImage) {
            fullScreenImage.classList.remove('full-screen');
            document.removeEventListener('keydown', exitFullScreenOnEsc);
        }
    }
}

