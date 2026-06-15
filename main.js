'use strict';

// ============================================================
//  SKETCHFAB VIEWER API — Sony Alpha 3
//  Mouse movement → spherical camera orbit via postMessage API
// ============================================================
(function () {
    const MODEL_UID = '85314e5a828044b8abb75be7f3e8fd7a';
    const iframe    = document.getElementById('sketchfab-viewer');

    if (!iframe) return;

    // Wait for Sketchfab API script to be ready
    function tryInit() {
        if (!window.Sketchfab) {
            setTimeout(tryInit, 200);
            return;
        }
        initViewer();
    }
    tryInit();

    function initViewer() {
        const client = new window.Sketchfab(iframe);

        let sfApi      = null;
        let modelCenter = null;  // [x, y, z] — center of the model
        let camRadius  = 0;      // distance from eye to center

        // Spherical angles (radians)
        let baseTheta  = 0;      // initial horizontal angle
        let basePhi    = 0;      // initial vertical angle
        let tgtTheta   = 0;
        let tgtPhi     = 0;
        let curTheta   = 0;
        let curPhi     = 0;

        client.init(MODEL_UID, {
            // ── Appearance ──────────────────────────────────────
            autostart:      1,
            preload:        1,
            ui_controls:    0,   // hide toolbar
            ui_infos:       0,   // hide model info
            ui_watermark:   0,   // hide badge (Pro feature; degrades gracefully)
            ui_stop:        0,
            ui_fullscreen:  0,
            ui_help:        0,
            ui_settings:    0,
            ui_vr:          0,
            ui_ar:          0,
            ui_hint:        0,
            ui_theme:       'dark',
            transparent:    1,
            // ── Callbacks ───────────────────────────────────────
            success: function (api) {
                sfApi = api;
                api.start();

                api.addEventListener('viewerready', function () {
                    // Dark background so model sits against the page color
                    api.setBackground({ color: [0.03, 0.03, 0.03] }, function () {});

                    // Hold the cover a few extra seconds so Sketchfab's hint
                    // has time to appear and vanish before we reveal the model
                    var loader = document.getElementById('hero-loader');
                    if (loader) {
                        setTimeout(function () {
                            loader.classList.add('ready');
                            setTimeout(function () { loader.style.display = 'none'; }, 950);
                        }, 3200);
                    }

                    // Grab initial camera so we can orbit around the same target
                    api.getCameraLookAt(function (err, camera) {
                        if (err) { console.warn('Sketchfab getCameraLookAt error:', err); return; }

                        modelCenter = camera.target.slice(); // [x, y, z]
                        const eye   = camera.position;

                        // Radius of the orbit sphere — zoom in significantly
                        const dx = eye[0] - modelCenter[0];
                        const dy = eye[1] - modelCenter[1];
                        const dz = eye[2] - modelCenter[2];
                        const origRadius = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        camRadius = origRadius * 0.22; // zoom level

                        // Force a horizontal viewing angle and rotate 180° from
                        // the initial side view to find the lens-facing front
                        basePhi   = Math.PI * 0.72; // look from below — lens points down on this model
                        baseTheta = Math.atan2(dz, dx) + Math.PI / 2;

                        curTheta = tgtTheta = baseTheta;
                        curPhi   = tgtPhi   = basePhi;

                        // Start the smooth camera loop
                        cameraLoop();
                    });
                });
            },
            error: function () {
                console.warn('Sketchfab: viewer failed to initialize.');
            },
        });

        // ── Mouse / touch tracking ──────────────────────────────
        document.addEventListener('mousemove', function (e) {
            const nx = (e.clientX / window.innerWidth  - 0.5) * 2; // −1 … +1
            const ny = (e.clientY / window.innerHeight - 0.5) * 2; // −1 … +1

            tgtTheta = baseTheta - nx * 0.55; // ±0.55 rad horizontal sweep
            tgtPhi   = basePhi   + ny * 0.28; // ±0.28 rad vertical sweep
            // Clamp to avoid flipping over the poles
            tgtPhi   = Math.max(0.25, Math.min(Math.PI - 0.25, tgtPhi));
        });

        document.addEventListener('touchmove', function (e) {
            const t  = e.touches[0];
            const nx = (t.clientX / window.innerWidth  - 0.5) * 2;
            const ny = (t.clientY / window.innerHeight - 0.5) * 2;
            tgtTheta = baseTheta - nx * 0.55;
            tgtPhi   = Math.max(0.25, Math.min(Math.PI - 0.25, basePhi + ny * 0.28));
        }, { passive: true });

        // ── Smooth camera orbit loop ────────────────────────────
        function cameraLoop() {
            if (!sfApi || !modelCenter) { requestAnimationFrame(cameraLoop); return; }

            const LERP = 0.045; // smoothing factor (lower = smoother but slower)
            curTheta += (tgtTheta - curTheta) * LERP;
            curPhi   += (tgtPhi   - curPhi)   * LERP;

            // Convert spherical → Cartesian eye position
            const eye = [
                modelCenter[0] + camRadius * Math.sin(curPhi)  * Math.cos(curTheta),
                modelCenter[1] + camRadius * Math.cos(curPhi),
                modelCenter[2] + camRadius * Math.sin(curPhi)  * Math.sin(curTheta),
            ];

            // duration=0 → immediate update; smoothing is handled by our lerp above
            sfApi.setCameraLookAt(eye, modelCenter, 0);

            requestAnimationFrame(cameraLoop);
        }
    }
})();


// ============================================================
//  NAV — darken on scroll
// ============================================================
const nav = document.getElementById('nav');
window.addEventListener('scroll', function () {
    nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });


// ============================================================
//  HERO TEXT — staggered fade-in
// ============================================================
const heroEls = [
    '.hero-eyebrow',
    '.name-brady',
    '.name-montgomery',
    '.hero-role',
    '.hero-ctas',
].map(function (s) { return document.querySelector(s); }).filter(Boolean);

heroEls.forEach(function (el, i) {
    el.style.cssText = [
        'opacity:0',
        'transform:translateY(16px)',
        'transition:opacity 0.7s ease ' + (i * 0.1 + 0.3) + 's, transform 0.7s ease ' + (i * 0.1 + 0.3) + 's',
    ].join(';');
});

// Trigger on next paint
requestAnimationFrame(function () {
    requestAnimationFrame(function () {
        heroEls.forEach(function (el) {
            el.style.opacity   = '1';
            el.style.transform = 'translateY(0)';
        });
    });
});


// ============================================================
//  SCROLL REVEAL — portfolio items, service cards
// ============================================================
function revealOnScroll(selector, staggerMs) {
    staggerMs = staggerMs || 70;
    var els = Array.from(document.querySelectorAll(selector));
    if (!els.length) return;

    els.forEach(function (el) {
        el.style.opacity   = '0';
        el.style.transform = 'translateY(24px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });

    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var i = els.indexOf(entry.target);
            setTimeout(function () {
                entry.target.style.opacity   = '1';
                entry.target.style.transform = 'translateY(0)';
            }, i * staggerMs);
            io.unobserve(entry.target);
        });
    }, { threshold: 0.1 });

    els.forEach(function (el) { io.observe(el); });
}

// Shuffle portfolio items so categories are mixed
(function () {
    var grid  = document.querySelector('.portfolio-grid');
    if (!grid) return;
    var items = Array.from(grid.children);
    for (var i = items.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        grid.appendChild(items[j]);
        items.splice(j, 1);
    }
})();

revealOnScroll('.portfolio-item', 55);
revealOnScroll('.service-card',   80);


// ============================================================
//  SKILL BARS — animate on scroll
// ============================================================
var skillFills = Array.from(document.querySelectorAll('.skill-fill'));
var skillIO    = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.style.transition = 'width 1.4s cubic-bezier(0.4, 0, 0.2, 1)';
        el.style.width = (el.dataset.width || '80') + '%';
        skillIO.unobserve(el);
    });
}, { threshold: 0.4 });
skillFills.forEach(function (el) { skillIO.observe(el); });


// ============================================================
//  PORTFOLIO FILTER
// ============================================================
var filterBtns     = document.querySelectorAll('.filter-btn');
var portfolioItems = Array.from(document.querySelectorAll('.portfolio-item'));
var ALL_PREVIEW    = 10;

// Create load-more button
var loadMoreBtn = document.createElement('button');
loadMoreBtn.className   = 'btn-primary';
loadMoreBtn.textContent = 'SEE ALL';
loadMoreBtn.style.cssText = 'display:none; margin: 2rem auto 0; display:none;';
var portfolioCta = document.querySelector('.portfolio-cta');
if (portfolioCta) portfolioCta.prepend(loadMoreBtn);

function applyFilter(filter, showAll) {
    var matched = portfolioItems.filter(function (item) {
        return filter === 'all' || item.dataset.category === filter;
    });
    var hidden = portfolioItems.filter(function (item) {
        return filter !== 'all' && item.dataset.category !== filter;
    });

    // Hide non-matching
    hidden.forEach(function (item) {
        item.style.opacity   = '0';
        item.style.transform = 'scale(0.95)';
        setTimeout(function () { item.style.display = 'none'; }, 300);
    });

    // Show matching
    var limit = (filter === 'all' && !showAll) ? ALL_PREVIEW : matched.length;
    matched.forEach(function (item, i) {
        if (i < limit) {
            item.style.display   = '';
            item.style.opacity   = '1';
            item.style.transform = 'scale(1)';
        } else {
            item.style.opacity   = '0';
            item.style.transform = 'scale(0.95)';
            setTimeout(function () { item.style.display = 'none'; }, 300);
        }
    });

    // Show/hide load-more button
    var needsMore = filter === 'all' && !showAll && matched.length > ALL_PREVIEW;
    loadMoreBtn.style.display = needsMore ? 'block' : 'none';
}

// Initial state — show 10
applyFilter('all', false);

filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        applyFilter(btn.dataset.filter, false);
    });
});

loadMoreBtn.addEventListener('click', function () {
    applyFilter('all', true);
    loadMoreBtn.style.display = 'none';
});


// ============================================================
//  CONTACT FORM
// ============================================================
var contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn  = contactForm.querySelector('button[type="submit"]');
        var orig = btn.textContent;
        btn.textContent = 'SENDING...';
        btn.disabled    = true;

        fetch('https://formspree.io/f/mnjywrlz', {
            method:  'POST',
            headers: { 'Accept': 'application/json' },
            body:    new FormData(contactForm),
        })
        .then(function (res) {
            if (res.ok) {
                btn.textContent      = 'SENT ✓';
                btn.style.background = '#285238';
                contactForm.reset();
                setTimeout(function () {
                    btn.textContent      = orig;
                    btn.style.background = '';
                    btn.disabled         = false;
                }, 3000);
            } else {
                btn.textContent = 'ERROR — TRY AGAIN';
                btn.disabled    = false;
            }
        })
        .catch(function () {
            btn.textContent = 'ERROR — TRY AGAIN';
            btn.disabled    = false;
        });
    });
}


// ============================================================
//  LIGHTBOX
// ============================================================
var lightbox     = document.getElementById('lightbox');
var lightboxImg  = document.getElementById('lightbox-img');
var lightboxClose = document.getElementById('lightbox-close');

function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.style.display = 'flex';
    requestAnimationFrame(function () {
        requestAnimationFrame(function () { lightbox.classList.add('open'); });
    });
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.remove('open');
    setTimeout(function () {
        lightbox.style.display = 'none';
        lightboxImg.src = '';
    }, 250);
    document.body.style.overflow = '';
}

document.querySelectorAll('.portfolio-item img').forEach(function (img) {
    img.parentElement.addEventListener('click', function () {
        openLightbox(img.src, img.alt);
    });
});

lightbox.addEventListener('click', function (e) {
    if (e.target !== lightboxImg) closeLightbox();
});
lightboxClose.addEventListener('click', closeLightbox);
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
});


// ============================================================
//  SMOOTH ANCHOR SCROLL
// ============================================================
document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
        var target = document.querySelector(a.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});
