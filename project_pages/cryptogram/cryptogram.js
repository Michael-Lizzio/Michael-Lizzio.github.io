// JavaScript for the first example images
function changeMainImage(newSrc) {
  const mainImage = document.getElementById('mainImage');
  mainImage.src = newSrc;
}

// JavaScript for the typing effect animation
const paragraphs = document.querySelectorAll('.typing-effect');

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('animate-typing')) {
            entry.target.classList.add('animate-typing');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

paragraphs.forEach(paragraph => {
    observer.observe(paragraph);
});

// JavaScript for the image board grid section
const images = document.querySelectorAll('.grid-item img');

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
        const fullScreenImage = document.querySelector('.grid-item img.full-screen');
        if (fullScreenImage) {
            fullScreenImage.classList.remove('full-screen');
            document.removeEventListener('keydown', exitFullScreenOnEsc);
        }
    }
}

