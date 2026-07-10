function updateClock() {
    const clockEl = document.getElementById('clock');
    if (!clockEl) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    clockEl.textContent = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
}
setInterval(updateClock, 1000);
updateClock();

function navigateTo(encodedUrl) {
    try {
        const decodedUrl = atob(encodedUrl);
        const secureToken = btoa("RYUOX_SECURE_ENTRY_" + Math.floor(Date.now() / 60000));
        sessionStorage.setItem('allowed_entry', secureToken);
        window.location.href = decodedUrl;
    } catch (e) {
        console.error("Navigation error:", e);
    }
}

document.querySelectorAll('[data-url]').forEach(element => {
    element.addEventListener('click', () => {
        navigateTo(element.getAttribute('data-url'));
    });
});

window.addEventListener('DOMContentLoaded', () => {
    const isMobile = window.innerWidth <= 992;
    if (!isMobile) {
        const firstCard = document.querySelector('.card');
        if (firstCard) firstCard.focus();
    }
});


document.addEventListener('keydown', function(e) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'];
    if (!keys.includes(e.key)) return;

    const active = document.activeElement;

    if (e.key === 'Enter') {
        if (active && active.hasAttribute('data-url')) {
            navigateTo(active.getAttribute('data-url'));
            e.preventDefault();
        } else if (active) {
            active.click();
            e.preventDefault();
        }
        return;
    }

    const focusableElements = Array.from(document.querySelectorAll('.focusable'));
    if (focusableElements.length === 0) return;

    if (!active || !focusableElements.includes(active)) {
        focusableElements[0].focus();
        e.preventDefault();
        return;
    }

    const activeRect = active.getBoundingClientRect();
    const activeCenter = {
        x: activeRect.left + activeRect.width / 2,
        y: activeRect.top + activeRect.height / 2
    };

    let bestCandidate = null;
    let minDistance = Infinity;
    
    const weight_primary = 1;    
    const weight_orthogonal = 8; 

    focusableElements.forEach(el => {
        if (el === active) return;

        const rect = el.getBoundingClientRect();
        const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };

        const dx = center.x - activeCenter.x;
        const dy = center.y - activeCenter.y;

        let isValidDirection = false;
        let distance = Infinity;

        if (e.key === 'ArrowLeft' && dx < -2) {
            isValidDirection = true;
            distance = Math.abs(dx) * weight_primary + Math.abs(dy) * weight_orthogonal;
        } else if (e.key === 'ArrowRight' && dx > 2) {
            isValidDirection = true;
            distance = Math.abs(dx) * weight_primary + Math.abs(dy) * weight_orthogonal;
        } else if (e.key === 'ArrowUp' && dy < -2) {
            isValidDirection = true;
            distance = Math.abs(dy) * weight_primary + Math.abs(dx) * weight_orthogonal;
        } else if (e.key === 'ArrowDown' && dy > 2) {
            isValidDirection = true;
            distance = Math.abs(dy) * weight_primary + Math.abs(dx) * weight_orthogonal;
        }

        if (isValidDirection && distance < minDistance) {
            minDistance = distance;
            bestCandidate = el;
        }
    });

    if (bestCandidate) {
        bestCandidate.focus();
        e.preventDefault();
    }
});

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || 
        (e.ctrlKey && e.key === 'u') || 
        (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key.toUpperCase()))) {
        e.preventDefault();
        document.body.innerHTML = "<h1 style='color: red; text-align: center; margin-top: 20%;'>Security Shield Activated. Access Denied!</h1>";
        window.location.reload();
        return false;
    }
});

setInterval(function() {
    const threshold = 160;
    if ((window.outerWidth - window.innerWidth) > threshold || (window.outerHeight - window.innerHeight) > threshold) {
        document.body.innerHTML = "<h1 style='color: red; text-align: center; margin-top: 20%;'>Security Shield Activated. Access Denied!</h1>";
        window.location.reload();
    }
}, 1000);
