/**
 * FormatFlow Landing Page JavaScript
 * Handles animations, interactions, and user experience
 */

class LandingPage {
    constructor() {
        this.navbar = document.getElementById('mainNavbar');
        this.heroSection = document.querySelector('.hero-section');
        this.scrollIndicator = document.querySelector('.scroll-indicator');
        this.ctaButtons = document.querySelectorAll('.cta-primary');
        
        this.init();
    }

    init() {
        this.initAOS();
        this.initNavbar();
        this.initScrollEffects();
        this.initButtonEffects();
        this.initDocumentAnimation();
        this.initParallax();
        this.initSmoothScroll();
        this.initFeatures();
        this.initBubbles();
        this.initHowItWorks();
        this.initTestimonials();
        this.initPricing();
        this.initFinalCTA();
        this.initPerformanceOptimizations();
        this.initAccessibility();
        
        // Start animations after page load
        window.addEventListener('load', () => {
            this.startHeroAnimations();
        });
    }

    /**
     * Initialize AOS (Animate On Scroll) library
     */
    initAOS() {
        if (typeof AOS !== 'undefined') {
            AOS.init({
                duration: 800,
                easing: 'ease-out-cubic',
                once: true,
                offset: 50,
                disable: 'mobile'
            });
        }
    }

    /**
     * Initialize navbar scroll effects
     */
    initNavbar() {
        let lastScrollY = window.scrollY;
        let isScrollingDown = false;
        
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            const heroHeight = this.heroSection ? this.heroSection.offsetHeight : 800;
            
            // Add scrolled class only after crossing hero section
            if (currentScrollY > heroHeight - 100) {
                this.navbar.classList.add('scrolled');
            } else {
                this.navbar.classList.remove('scrolled');
            }

            // Hide/show navbar on scroll (only when fixed)
            if (this.navbar.classList.contains('scrolled')) {
                if (currentScrollY > lastScrollY && currentScrollY > heroHeight) {
                    if (!isScrollingDown) {
                        this.navbar.style.transform = 'translateY(-100%)';
                        isScrollingDown = true;
                    }
                } else {
                    if (isScrollingDown) {
                        this.navbar.style.transform = 'translateY(0)';
                        isScrollingDown = false;
                    }
                }
            }

            lastScrollY = currentScrollY;
        });
    }

    /**
     * Initialize scroll-based effects
     */
    initScrollEffects() {
        // Parallax effect for hero content
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;
            
            if (this.heroSection) {
                const heroContent = this.heroSection.querySelector('.hero-content');
                if (heroContent && scrolled < window.innerHeight) {
                    heroContent.style.transform = `translateY(${rate}px)`;
                }
            }

            // Hide scroll indicator when scrolling
            if (this.scrollIndicator) {
                const opacity = Math.max(0, 1 - scrolled / 300);
                this.scrollIndicator.style.opacity = opacity;
            }
        });

        // Intersection Observer for animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);

        // Observe elements for animation
        document.querySelectorAll('.stat-item, .floating-element').forEach(el => {
            observer.observe(el);
        });
    }

    /**
     * Initialize button ripple effects
     */
    initButtonEffects() {
        this.ctaButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const ripple = button.querySelector('.btn-ripple');
                if (ripple) {
                    ripple.style.width = '0';
                    ripple.style.height = '0';
                    
                    setTimeout(() => {
                        ripple.style.width = '300px';
                        ripple.style.height = '300px';
                    }, 10);
                    
                    setTimeout(() => {
                        ripple.style.width = '0';
                        ripple.style.height = '0';
                    }, 600);
                }
            });
        });

        // Magnetic effect for buttons
        document.querySelectorAll('.btn').forEach(button => {
            button.addEventListener('mousemove', (e) => {
                const rect = button.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                
                button.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translate(0, 0)';
            });
        });
    }

    /**
     * Initialize document merging animation
     */
    initDocumentAnimation() {
        const documentItems = document.querySelectorAll('.document-item.merging');
        const finalDocument = document.querySelector('.final-document');
        const successCheck = document.querySelector('.success-check');

        if (documentItems.length > 0) {
            // Stagger the document animations
            documentItems.forEach((item, index) => {
                setTimeout(() => {
                    item.style.animationPlayState = 'running';
                }, index * 500);
            });

            // Show final document after merge animation
            setTimeout(() => {
                if (finalDocument) {
                    finalDocument.style.opacity = '0';
                    finalDocument.style.transform = 'scale(0.8)';
                    finalDocument.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                    
                    setTimeout(() => {
                        finalDocument.style.opacity = '1';
                        finalDocument.style.transform = 'scale(1)';
                    }, 100);
                }
            }, 2000);

            // Animate success checkmark
            setTimeout(() => {
                if (successCheck) {
                    successCheck.style.animationPlayState = 'running';
                }
            }, 2500);
        }
    }

    /**
     * Initialize parallax effects for floating shapes
     */
    initParallax() {
        const shapes = document.querySelectorAll('.floating-shape');
        
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            
            shapes.forEach((shape, index) => {
                const speed = 0.5 + (index * 0.1);
                const yPos = -(scrolled * speed);
                shape.style.transform = `translate3d(0, ${yPos}px, 0)`;
            });
        });

        // Mouse parallax effect
        document.addEventListener('mousemove', (e) => {
            const mouseX = e.clientX / window.innerWidth;
            const mouseY = e.clientY / window.innerHeight;

            shapes.forEach((shape, index) => {
                const speed = 10 + (index * 5);
                const x = (mouseX - 0.5) * speed;
                const y = (mouseY - 0.5) * speed;
                
                const scrolled = window.pageYOffset;
                const scrollSpeed = 0.5 + (index * 0.1);
                const yScrollPos = -(scrolled * scrollSpeed);
                
                shape.style.transform = `translate3d(${x}px, ${y + yScrollPos}px, 0)`;
            });
        });
    }

    /**
     * Initialize smooth scrolling for navigation links
     */
    initSmoothScroll() {
        // Smooth scroll for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                
                if (target) {
                    const offsetTop = target.offsetTop - 80; // Account for navbar height
                    
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        });

        // Scroll indicator click
        if (this.scrollIndicator) {
            this.scrollIndicator.addEventListener('click', () => {
                window.scrollTo({
                    top: window.innerHeight,
                    behavior: 'smooth'
                });
            });
        }

        // Initialize active nav link highlighting
        this.initActiveNavLinks();
    }

    /**
     * Initialize active navigation link highlighting
     */
    initActiveNavLinks() {
        const navLinks = document.querySelectorAll('.navbar-nav .nav-link[href^="#"]');
        const sections = document.querySelectorAll('section[id]');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const currentSection = entry.target.id;
                    
                    // Remove active class from all nav links
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                    });
                    
                    // Add active class to corresponding nav link
                    const activeLink = document.querySelector(`.navbar-nav .nav-link[href="#${currentSection}"]`);
                    if (activeLink) {
                        activeLink.classList.add('active');
                    }
                }
            });
        }, {
            threshold: 0.3,
            rootMargin: '-80px 0px -50% 0px'
        });

        sections.forEach(section => {
            observer.observe(section);
        });
    }

    /**
     * Start hero section animations
     */
    startHeroAnimations() {
        // Animate hero badge
        const heroBadge = document.querySelector('.hero-badge');
        if (heroBadge) {
            heroBadge.style.opacity = '0';
            heroBadge.style.transform = 'translateY(20px)';
            setTimeout(() => {
                heroBadge.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                heroBadge.style.opacity = '1';
                heroBadge.style.transform = 'translateY(0)';
            }, 200);
        }

        // Animate title with typewriter effect
        const heroTitle = document.querySelector('.hero-title');
        if (heroTitle) {
            setTimeout(() => {
                this.typewriterEffect(heroTitle, 60);
            }, 600);
        }

        // Animate stats with counting effect
        setTimeout(() => {
            this.animateStats();
        }, 2200);
    }

    /**
     * Typewriter effect for text animation
     */
    typewriterEffect(element, delay = 50) {
        const text = element.textContent;
        element.textContent = '';
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
        
        let i = 0;
        const timer = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(timer);
            }
        }, delay);
    }

    /**
     * Animate statistics with counting effect
     */
    animateStats() {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        statNumbers.forEach(stat => {
            const finalValue = stat.textContent;
            const numericValue = parseInt(finalValue.replace(/[^\d]/g, ''));
            
            if (!isNaN(numericValue)) {
                let currentValue = 0;
                const increment = numericValue / 50; // 50 steps
                
                stat.textContent = '0';
                
                const counter = setInterval(() => {
                    currentValue += increment;
                    
                    if (currentValue >= numericValue) {
                        stat.textContent = finalValue;
                        clearInterval(counter);
                    } else {
                        const suffix = finalValue.includes('K') ? 'K' : 
                                     finalValue.includes('%') ? '%' : '';
                        const displayValue = finalValue.includes('K') ? 
                            Math.floor(currentValue / 1000) : Math.floor(currentValue);
                        stat.textContent = displayValue + suffix;
                    }
                }, 50);
            }
        });
    }

    /**
     * Initialize features section interactions
     */
    initFeatures() {
        const featureCards = document.querySelectorAll('.feature-card');
        
        featureCards.forEach(card => {
            // Add ripple effect on click
            card.addEventListener('click', (e) => {
                this.createRippleEffect(e, card);
            });
            
            // Enhanced hover effects
            card.addEventListener('mouseenter', () => {
                this.animateFeatureIcon(card);
            });
            
            // Stagger animations when cards come into view
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.style.animationDelay = '0s';
                            entry.target.classList.add('animate-in');
                            observer.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.1 });
                
                observer.observe(card);
            }
        });
        
        // Animate feature tags on scroll
        this.initFeatureTags();
    }
    
    /**
     * Create ripple effect for feature cards
     */
    createRippleEffect(e, element) {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(139, 92, 246, 0.3);
            transform: scale(0);
            animation: ripple 0.6s linear;
            left: ${x - 10}px;
            top: ${y - 10}px;
            width: 20px;
            height: 20px;
            pointer-events: none;
            z-index: 1000;
        `;
        
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
    
    /**
     * Animate feature card icons
     */
    animateFeatureIcon(card) {
        const icon = card.querySelector('.feature-icon i');
        const iconGlow = card.querySelector('.icon-glow');
        
        if (icon) {
            icon.style.animation = 'none';
            setTimeout(() => {
                icon.style.animation = 'iconBounce 0.6s ease-out';
            }, 10);
        }
        
        if (iconGlow) {
            iconGlow.style.animation = 'iconPulse 1s ease-out';
        }
    }
    
    /**
     * Initialize feature tags animations
     */
    initFeatureTags() {
        const tags = document.querySelectorAll('.tag');
        
        if ('IntersectionObserver' in window) {
            const tagObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry, index) => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            entry.target.style.transform = 'translateY(-2px) scale(1.05)';
                            entry.target.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                        }, index * 100);
                        tagObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });
            
            tags.forEach(tag => tagObserver.observe(tag));
        }
    }

    /**
     * Initialize bubble background animations
     */
    initBubbles() {
        const bubbleContainer = document.querySelector('.bubble-background');
        if (!bubbleContainer) return;

        // Create additional dynamic bubbles
        this.createDynamicBubbles();
        
        // Add mouse interaction for bubbles
        this.initBubbleInteractions();
        
        // Performance optimization: pause bubbles when page is hidden
        document.addEventListener('visibilitychange', () => {
            const bubbles = document.querySelectorAll('.bubble');
            if (document.hidden) {
                bubbles.forEach(bubble => {
                    bubble.style.animationPlayState = 'paused';
                });
            } else {
                bubbles.forEach(bubble => {
                    bubble.style.animationPlayState = 'running';
                });
            }
        });
    }
    
    /**
     * Create additional dynamic bubbles with enhanced coverage
     */
    createDynamicBubbles() {
        const bubbleContainer = document.querySelector('.bubble-background');
        if (!bubbleContainer) return;

        const sizes = ['small', 'medium', 'large', 'extra-large'];
        const totalBubbles = 45; // Increased for better coverage

        // Clear existing dynamic bubbles
        const existingBubbles = bubbleContainer.querySelectorAll('.bubble:not([data-static])');
        existingBubbles.forEach(bubble => bubble.remove());

        // Create 45 bubbles for comprehensive page coverage
        for (let i = 0; i < totalBubbles; i++) {
            const bubble = document.createElement('div');
            bubble.className = `bubble ${sizes[Math.floor(Math.random() * sizes.length)]}`;
            
            // Enhanced distribution - ensure coverage across viewport height
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            
            bubble.style.top = y + '%';
            bubble.style.left = x + '%';
            
            // Staggered animation delays for continuous movement
            bubble.style.animationDelay = (Math.random() * 45) + 's';
            bubble.style.animationDuration = (18 + Math.random() * 20) + 's';
            
            // Vary animation directions for more natural movement
            if (Math.random() > 0.5) {
                bubble.style.animationDirection = 'reverse';
            }
            
            // Dynamic opacity and intensity based on size
            const sizeMultiplier = sizes.indexOf(bubble.className.split(' ')[1]) + 1;
            const baseOpacity = 0.15 + (Math.random() * 0.25);
            const finalOpacity = Math.min(baseOpacity * (5 - sizeMultiplier), 0.6);
            
            bubble.style.background = `linear-gradient(45deg, 
                rgba(139, 92, 246, ${finalOpacity}), 
                rgba(139, 92, 246, ${finalOpacity * 0.3})
            )`;
            bubble.style.borderColor = `rgba(139, 92, 246, ${finalOpacity * 0.6})`;
            
            // Assign animation pattern based on size and position
            const animations = ['bubbleFloatSmall', 'bubbleFloatMedium', 'bubbleFloatLarge', 'bubbleFloatXLarge'];
            const animationIndex = Math.floor(Math.random() * animations.length);
            bubble.style.animationName = animations[animationIndex];
            
            // Add transform origin variation for more organic movement
            bubble.style.transformOrigin = `${Math.random() * 100}% ${Math.random() * 100}%`;
            
            bubbleContainer.appendChild(bubble);
        }

        // Create section-specific bubbles for enhanced coverage
        this.createSectionBubbles();
    }

    /**
     * Create additional bubbles for specific sections
     */
    createSectionBubbles() {
        const sections = [
            '.hero-section',
            '.features-section', 
            '.how-it-works-section'
        ];

        sections.forEach((sectionSelector, sectionIndex) => {
            const section = document.querySelector(sectionSelector);
            if (!section) return;

            // Create or find section bubble container
            let sectionBubbles = section.querySelector('.section-bubbles');
            if (!sectionBubbles) {
                sectionBubbles = document.createElement('div');
                sectionBubbles.className = 'section-bubbles';
                section.appendChild(sectionBubbles);
            }

            // Add 8-12 bubbles per section for layered effect
            const sectionBubbleCount = 8 + Math.floor(Math.random() * 5);
            
            for (let i = 0; i < sectionBubbleCount; i++) {
                const bubble = document.createElement('div');
                const sizes = ['small', 'medium', 'large'];
                bubble.className = `bubble ${sizes[Math.floor(Math.random() * sizes.length)]}`;
                
                // Position within section bounds
                bubble.style.top = Math.random() * 100 + '%';
                bubble.style.left = Math.random() * 100 + '%';
                
                // Unique timing per section
                const sectionDelay = sectionIndex * 15; // Offset per section
                bubble.style.animationDelay = (sectionDelay + Math.random() * 30) + 's';
                bubble.style.animationDuration = (15 + Math.random() * 25) + 's';
                
                // Section-specific intensity
                const sectionOpacity = 0.08 + (Math.random() * 0.15);
                bubble.style.background = `linear-gradient(45deg, 
                    rgba(139, 92, 246, ${sectionOpacity}), 
                    rgba(139, 92, 246, ${sectionOpacity * 0.2})
                )`;
                
                // Vary animation patterns
                const animations = ['bubbleFloatSmall', 'bubbleFloatMedium', 'bubbleFloatLarge'];
                bubble.style.animationName = animations[Math.floor(Math.random() * animations.length)];
                
                sectionBubbles.appendChild(bubble);
            }
        });
    }
    
    /**
     * Add mouse interaction effects for bubbles
     */
    initBubbleInteractions() {
        const bubbles = document.querySelectorAll('.bubble');
        
        // Mouse move effect - bubbles respond to cursor
        document.addEventListener('mousemove', this.throttle((e) => {
            const mouseX = e.clientX / window.innerWidth;
            const mouseY = e.clientY / window.innerHeight;
            
            bubbles.forEach((bubble, index) => {
                const rect = bubble.getBoundingClientRect();
                const bubbleX = (rect.left + rect.width / 2) / window.innerWidth;
                const bubbleY = (rect.top + rect.height / 2) / window.innerHeight;
                
                const distance = Math.sqrt(
                    Math.pow(mouseX - bubbleX, 2) + Math.pow(mouseY - bubbleY, 2)
                );
                
                // Create subtle attraction effect
                if (distance < 0.15) {
                    const attraction = (0.15 - distance) * 20;
                    const deltaX = (mouseX - bubbleX) * attraction;
                    const deltaY = (mouseY - bubbleY) * attraction;
                    
                    bubble.style.transform += ` translate(${deltaX}px, ${deltaY}px)`;
                    bubble.style.opacity = Math.min(0.8, parseFloat(bubble.style.opacity || 0.6) + 0.2);
                }
            });
        }, 50));
        
        // Reset bubble positions periodically
        setInterval(() => {
            bubbles.forEach(bubble => {
                bubble.style.transform = '';
                bubble.style.opacity = '';
            });
        }, 5000);
    }

    /**
     * Utility method to debounce function calls
     */
    debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    /**
     * Performance optimization for scroll events
     */
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Initialize How It Works section interactions
     */
    initHowItWorks() {
        this.initProcessSteps();
        this.initTimelineProgress();
        this.initStepAnimations();
    }

    initProcessSteps() {
        const steps = document.querySelectorAll('.process-step');
        
        steps.forEach((step, index) => {
            // Add intersection observer for animation
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            entry.target.style.opacity = '1';
                            entry.target.style.transform = 'translateY(0)';
                        }, index * 200); // Stagger animation
                    }
                });
            }, {
                threshold: 0.2,
                rootMargin: '0px 0px -50px 0px'
            });
            
            // Set initial state
            step.style.opacity = '0';
            step.style.transform = 'translateY(30px)';
            step.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            
            observer.observe(step);
            
            // Add click interaction
            step.addEventListener('click', () => {
                this.highlightStep(index);
                this.animateStepDemo(step);
            });
            
            // Add hover effects
            step.addEventListener('mouseenter', () => {
                this.pauseTimelineAnimation();
                this.highlightTimelineStep(index);
            });
            
            step.addEventListener('mouseleave', () => {
                this.resumeTimelineAnimation();
                this.resetTimelineHighlight();
            });
        });
    }

    initTimelineProgress() {
        const timeline = document.querySelector('.timeline-progress');
        const section = document.querySelector('.how-it-works-section');
        
        if (!timeline || !section) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    timeline.style.animationPlayState = 'running';
                    this.startSequentialStepHighlight();
                } else {
                    timeline.style.animationPlayState = 'paused';
                    this.stopSequentialStepHighlight();
                }
            });
        }, {
            threshold: 0.3
        });
        
        observer.observe(section);
    }

    initStepAnimations() {
        // Initialize specific animations for each step type
        this.initUploadAnimations();
        this.initAnalysisAnimations();
        this.initMergeAnimations();
        this.initDownloadAnimations();
    }

    initUploadAnimations() {
        const uploadSteps = document.querySelectorAll('[data-step="upload"]');
        uploadSteps.forEach(step => {
            const fileIcon = step.querySelector('.file-icon');
            const arrow = step.querySelector('.upload-arrow');
            
            if (fileIcon && arrow) {
                this.createFloatingFiles(step);
            }
        });
    }

    initAnalysisAnimations() {
        const analysisSteps = document.querySelectorAll('[data-step="analysis"]');
        analysisSteps.forEach(step => {
            const demo = step.querySelector('.analysis-demo');
            if (demo) {
                this.createBrainWaves(demo);
                this.createScanningEffect(demo);
            }
        });
    }

    initMergeAnimations() {
        const mergeSteps = document.querySelectorAll('[data-step="merge"]');
        mergeSteps.forEach(step => {
            const demo = step.querySelector('.merge-demo');
            if (demo) {
                this.createMergeEffect(demo);
            }
        });
    }

    initDownloadAnimations() {
        const downloadSteps = document.querySelectorAll('[data-step="download"]');
        downloadSteps.forEach(step => {
            const demo = step.querySelector('.download-demo');
            if (demo) {
                this.createDownloadEffect(demo);
            }
        });
    }

    highlightStep(index) {
        const steps = document.querySelectorAll('.process-step');
        steps.forEach((step, i) => {
            step.classList.toggle('active', i === index);
        });
    }

    animateStepDemo(step) {
        const visual = step.querySelector('.step-visual');
        if (visual) {
            visual.style.transform = 'scale(1.1)';
            visual.style.transition = 'transform 0.3s ease';
            
            setTimeout(() => {
                visual.style.transform = 'scale(1)';
            }, 300);
        }
    }

    highlightTimelineStep(index) {
        const progress = document.querySelector('.timeline-progress');
        if (progress) {
            const percentage = ((index + 1) / 4) * 100;
            progress.style.width = `${percentage}%`;
            progress.style.transition = 'width 0.5s ease';
        }
    }

    resetTimelineHighlight() {
        const progress = document.querySelector('.timeline-progress');
        if (progress) {
            progress.style.transition = '';
            progress.style.width = '';
        }
    }

    pauseTimelineAnimation() {
        const progress = document.querySelector('.timeline-progress');
        if (progress) {
            progress.style.animationPlayState = 'paused';
        }
    }

    resumeTimelineAnimation() {
        const progress = document.querySelector('.timeline-progress');
        if (progress) {
            progress.style.animationPlayState = 'running';
        }
    }

    startSequentialStepHighlight() {
        if (this.stepHighlightInterval) return;
        
        let currentStep = 0;
        this.stepHighlightInterval = setInterval(() => {
            this.highlightStep(currentStep);
            currentStep = (currentStep + 1) % 4;
        }, 2000);
    }

    stopSequentialStepHighlight() {
        if (this.stepHighlightInterval) {
            clearInterval(this.stepHighlightInterval);
            this.stepHighlightInterval = null;
        }
    }

    createFloatingFiles(container) {
        const files = ['📄', '📊', '📋', '📈'];
        
        files.forEach((file, index) => {
            const fileElement = document.createElement('div');
            fileElement.textContent = file;
            fileElement.className = 'floating-file';
            fileElement.style.cssText = `
                position: absolute;
                font-size: 1.2rem;
                animation: floatUp 3s ease-in-out infinite;
                animation-delay: ${index * 0.5}s;
                opacity: 0.6;
                pointer-events: none;
                z-index: 1;
            `;
            
            container.style.position = 'relative';
            container.appendChild(fileElement);
        });
    }

    createBrainWaves(container) {
        for (let i = 0; i < 3; i++) {
            const wave = document.createElement('div');
            wave.className = `wave wave-${i + 1}`;
            container.appendChild(wave);
        }
        
        const scanLine = document.createElement('div');
        scanLine.className = 'scanning-line';
        container.appendChild(scanLine);
    }

    createScanningEffect(container) {
        const particles = [];
        for (let i = 0; i < 5; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: 3px;
                height: 3px;
                background: var(--accent-violet);
                border-radius: 50%;
                opacity: 0;
                animation: particleScan 2s ease-in-out infinite;
                animation-delay: ${i * 0.2}s;
            `;
            particles.push(particle);
            container.appendChild(particle);
        }
    }

    createMergeEffect(container) {
        const effect = document.createElement('div');
        effect.className = 'magic-particles';
        effect.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            height: 100%;
            pointer-events: none;
        `;
        
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                background: var(--accent-violet);
                border-radius: 50%;
                animation: magicParticle 2s ease-in-out infinite;
                animation-delay: ${i * 0.25}s;
                opacity: 0.7;
            `;
            
            const angle = (i / 8) * 360;
            particle.style.transform = `rotate(${angle}deg) translateX(20px)`;
            effect.appendChild(particle);
        }
        
        container.appendChild(effect);
    }

    createDownloadEffect(container) {
        const progressBar = document.createElement('div');
        progressBar.className = 'download-progress';
        progressBar.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: #e2e8f0;
            border-radius: 2px;
            overflow: hidden;
        `;
        
        const progress = document.createElement('div');
        progress.style.cssText = `
            height: 100%;
            background: var(--gradient-primary);
            width: 0%;
            animation: downloadProgress 3s ease-in-out infinite;
            border-radius: 2px;
        `;
        
        progressBar.appendChild(progress);
        container.appendChild(progressBar);
    }

    /**
     * Initialize Testimonials section interactions
     */
    initTestimonials() {
        this.initTestimonialCards();
        this.initTrustIndicators();
        this.initImageLazyLoading();
    }

    initTestimonialCards() {
        const cards = document.querySelectorAll('.testimonial-card');
        
        cards.forEach((card, index) => {
            // Add intersection observer for animation
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            entry.target.style.opacity = '1';
                            entry.target.style.transform = 'translateY(0)';
                        }, index * 150); // Stagger animation
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });
            
            // Set initial state
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            
            observer.observe(card);
            
            // Add click interaction
            card.addEventListener('click', () => {
                this.highlightTestimonial(card);
            });
            
            // Add keyboard navigation
            card.setAttribute('tabindex', '0');
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.highlightTestimonial(card);
                }
            });
            
            // Preload images
            const img = card.querySelector('.author-avatar img');
            if (img) {
                this.preloadImage(img.src);
            }
        });
    }

    initTrustIndicators() {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
                    const target = parseInt(entry.target.dataset.target);
                    if (!isNaN(target)) {
                        this.animateNumber(entry.target, 0, target, 2000);
                        entry.target.classList.add('animated');
                    }
                }
            });
        }, {
            threshold: 0.5
        });
        
        statNumbers.forEach(stat => {
            observer.observe(stat);
        });
    }

    animateNumber(element, start, end, duration) {
        // Safety checks for NaN values
        if (isNaN(start) || isNaN(end) || isNaN(duration) || !element) {
            console.warn('Invalid parameters for animateNumber:', { start, end, duration, element });
            return;
        }
        
        const startTime = performance.now();
        const isDecimal = end.toString().includes('.');
        
        const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = start + (end - start) * easeOutQuart;
            
            // Check for NaN before updating
            if (isNaN(currentValue)) {
                console.warn('NaN detected in animation, stopping');
                return;
            }
            
            if (isDecimal) {
                element.textContent = currentValue.toFixed(1);
            } else if (end >= 1000) {
                element.textContent = Math.floor(currentValue).toLocaleString();
            } else {
                element.textContent = Math.floor(currentValue);
            }
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                element.textContent = isDecimal ? end.toFixed(1) : 
                    (end >= 1000 ? end.toLocaleString() : end);
            }
        };
        
        requestAnimationFrame(updateNumber);
    }

    highlightTestimonial(card) {
        // Remove highlight from other cards
        document.querySelectorAll('.testimonial-card').forEach(c => {
            c.classList.remove('highlighted');
        });
        
        // Add highlight to clicked card
        card.classList.add('highlighted');
        
        // Add temporary pulse effect
        card.style.transform = 'scale(1.02)';
        setTimeout(() => {
            card.style.transform = '';
        }, 200);
        
        // Announce to screen readers
        this.announceToScreenReader(`Testimonial from ${card.querySelector('.author-name')?.textContent} highlighted`);
    }

    initImageLazyLoading() {
        const images = document.querySelectorAll('img[loading="lazy"]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.addEventListener('load', () => {
                            img.classList.add('loaded');
                        });
                        img.addEventListener('error', () => {
                            img.style.display = 'none';
                        });
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            images.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback for older browsers
            images.forEach(img => {
                img.addEventListener('load', () => {
                    img.classList.add('loaded');
                });
            });
        }
    }

    preloadImage(src) {
        const img = new Image();
        img.src = src;
    }

    /**
     * Initialize Pricing Section
     */
    initPricing() {
        this.initPricingCards();
        this.initPricingAnimations();
        this.initPricingInteractions();
    }

    initPricingCards() {
        const pricingCards = document.querySelectorAll('.pricing-card');
        
        pricingCards.forEach(card => {
            // Add hover effects
            card.addEventListener('mouseenter', () => {
                this.highlightPricingCard(card);
            });
            
            card.addEventListener('mouseleave', () => {
                this.unhighlightPricingCard(card);
            });
            
            // Add click tracking for analytics
            const ctaButton = card.querySelector('.btn-plan');
            if (ctaButton) {
                ctaButton.addEventListener('click', (e) => {
                    const planName = card.querySelector('.plan-name')?.textContent;
                    this.trackPlanSelection(planName, e);
                });
            }
        });
    }

    initPricingAnimations() {
        // Animate pricing cards on scroll
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('animate-in');
                    }, index * 100);
                }
            });
        }, {
            threshold: 0.3
        });

        const pricingCards = document.querySelectorAll('.pricing-card');
        pricingCards.forEach(card => {
            observer.observe(card);
        });

        // Animate price numbers
        this.initPriceCounters();
    }

    initPriceCounters() {
        const priceAmounts = document.querySelectorAll('.price-amount');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                    const target = parseInt(entry.target.textContent);
                    if (!isNaN(target) && target > 0) {
                        this.animatePrice(entry.target, 0, target, 1500);
                    }
                    entry.target.classList.add('counted');
                }
            });
        }, {
            threshold: 0.5
        });
        
        priceAmounts.forEach(amount => {
            observer.observe(amount);
        });
    }

    animatePrice(element, start, end, duration) {
        // Safety checks for NaN values
        if (isNaN(start) || isNaN(end) || isNaN(duration) || !element) {
            console.warn('Invalid parameters for animatePrice:', { start, end, duration, element });
            return;
        }
        
        const startTime = performance.now();
        
        const updatePrice = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOutQuint = 1 - Math.pow(1 - progress, 5);
            const currentValue = Math.floor(start + (end - start) * easeOutQuint);
            
            // Check for NaN before updating
            if (isNaN(currentValue)) {
                console.warn('NaN detected in price animation, stopping');
                return;
            }
            
            element.textContent = currentValue;
            
            if (progress < 1) {
                requestAnimationFrame(updatePrice);
            } else {
                element.textContent = end;
            }
        };
        
        requestAnimationFrame(updatePrice);
    }

    initPricingInteractions() {
        // Add FAQ toggle functionality
        const faqItems = document.querySelectorAll('.faq-item');
        
        faqItems.forEach(item => {
            item.addEventListener('click', () => {
                this.toggleFaqItem(item);
            });
            
            // Make FAQ items keyboard accessible
            item.setAttribute('tabindex', '0');
            item.setAttribute('role', 'button');
            item.setAttribute('aria-expanded', 'false');
            
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleFaqItem(item);
                }
            });
        });

        // Add plan comparison functionality
        this.initPlanComparison();
    }

    highlightPricingCard(card) {
        // Add glow effect
        card.style.boxShadow = '0 25px 50px rgba(139, 92, 246, 0.3)';
        
        // Slight scale animation
        card.style.transform = card.classList.contains('pricing-card-featured') 
            ? 'scale(1.05) translateY(-12px)' 
            : 'translateY(-12px)';
    }

    unhighlightPricingCard(card) {
        // Remove custom styles to return to CSS defaults
        card.style.boxShadow = '';
        card.style.transform = card.classList.contains('pricing-card-featured') 
            ? 'scale(1.05)' 
            : '';
    }

    toggleFaqItem(item) {
        const isExpanded = item.getAttribute('aria-expanded') === 'true';
        
        // Close all other FAQ items
        document.querySelectorAll('.faq-item').forEach(faq => {
            if (faq !== item) {
                faq.setAttribute('aria-expanded', 'false');
                faq.classList.remove('expanded');
            }
        });
        
        // Toggle current item
        item.setAttribute('aria-expanded', !isExpanded);
        item.classList.toggle('expanded');
        
        // Announce to screen readers
        const question = item.querySelector('.faq-question')?.textContent;
        this.announceToScreenReader(
            isExpanded ? `FAQ collapsed: ${question}` : `FAQ expanded: ${question}`
        );
    }

    initPlanComparison() {
        // Add compare functionality
        const compareButtons = document.querySelectorAll('[data-compare-plan]');
        
        compareButtons.forEach(button => {
            button.addEventListener('click', () => {
                const planName = button.dataset.comparePlan;
                this.showPlanComparison(planName);
            });
        });
    }

    trackPlanSelection(planName, event) {
        // Track plan selection for analytics (production analytics would go here)
        
        // Add loading state to button
        const button = event.target;
        const originalText = button.textContent;
        
        button.textContent = 'Loading...';
        button.disabled = true;
        
        // Simulate loading (remove this in production)
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 1500);
        
        // You can add real analytics tracking here
        // Example: gtag('event', 'plan_selection', { plan_name: planName });
    }

    showPlanComparison(planName) {
        // This could open a modal or navigate to a comparison page
        // Track comparison view (production analytics would go here)
        
        // Add visual feedback
        const card = document.querySelector(`[data-plan="${planName}"]`);
        if (card) {
            card.classList.add('pulse-highlight');
            setTimeout(() => {
                card.classList.remove('pulse-highlight');
            }, 1000);
        }
    }

    /**
     * Initialize Final CTA Section
     */
    initFinalCTA() {
        this.initCTAAnimations();
        this.initCTAInteractions();
        this.initStatCounters();
    }

    initCTAAnimations() {
        const ctaSection = document.querySelector('.final-cta-section');
        if (!ctaSection) return;

        // Animate CTA elements on scroll
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.startCTAAnimations();
                }
            });
        }, {
            threshold: 0.3
        });

        observer.observe(ctaSection);
    }

    startCTAAnimations() {
        // Animate stat badges
        const statBadges = document.querySelectorAll('.stat-badge');
        statBadges.forEach((badge, index) => {
            setTimeout(() => {
                badge.style.opacity = '0';
                badge.style.transform = 'translateY(30px)';
                badge.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                
                setTimeout(() => {
                    badge.style.opacity = '1';
                    badge.style.transform = 'translateY(0)';
                }, 50);
            }, index * 150);
        });

        // Animate CTA buttons
        const ctaButtons = document.querySelectorAll('.cta-buttons .btn');
        ctaButtons.forEach((button, index) => {
            setTimeout(() => {
                button.style.opacity = '0';
                button.style.transform = 'translateY(20px)';
                button.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                
                setTimeout(() => {
                    button.style.opacity = '1';
                    button.style.transform = 'translateY(0)';
                }, 50);
            }, 800 + (index * 100));
        });

        // Animate trust badges
        const trustBadges = document.querySelectorAll('.badge-item');
        trustBadges.forEach((badge, index) => {
            setTimeout(() => {
                badge.style.opacity = '0';
                badge.style.transform = 'translateY(15px)';
                badge.style.transition = 'all 0.4s ease-out';
                
                setTimeout(() => {
                    badge.style.opacity = '1';
                    badge.style.transform = 'translateY(0)';
                }, 50);
            }, 1200 + (index * 100));
        });
    }

    initCTAInteractions() {
        // Track CTA button clicks
        const ctaButtons = document.querySelectorAll('[data-track]');
        
        ctaButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const trackingId = button.dataset.track;
                this.trackCTAClick(trackingId, e);
            });
        });

        // Add ripple effect to CTA buttons
        const primaryButtons = document.querySelectorAll('.cta-primary');
        primaryButtons.forEach(button => {
            button.addEventListener('click', this.createRippleEffect.bind(this));
        });

        // Add hover effects to stat badges
        const statBadges = document.querySelectorAll('.stat-badge');
        statBadges.forEach(badge => {
            badge.addEventListener('mouseenter', () => {
                this.highlightStatBadge(badge);
            });
            
            badge.addEventListener('mouseleave', () => {
                this.unhighlightStatBadge(badge);
            });
        });
    }

    initStatCounters() {
        const statNumbers = document.querySelectorAll('.final-cta-section .stat-number');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                    const text = entry.target.textContent;
                    let targetValue;
                    
                    // Parse different number formats
                    if (text.includes('M+')) {
                        targetValue = parseInt(text) * 1000000;
                    } else if (text.includes('K+')) {
                        targetValue = parseInt(text) * 1000;
                    } else if (text.includes('%')) {
                        targetValue = parseFloat(text);
                    } else {
                        targetValue = parseInt(text.replace(/[^\d]/g, ''));
                    }
                    
                    // Only animate if we have a valid number
                    if (!isNaN(targetValue) && targetValue > 0) {
                        this.animateCTAStat(entry.target, 0, targetValue, text, 2000);
                        entry.target.classList.add('counted');
                    }
                }
            });
        }, {
            threshold: 0.5
        });
        
        statNumbers.forEach(stat => {
            observer.observe(stat);
        });
    }

    animateCTAStat(element, start, end, originalText, duration) {
        // Safety checks for NaN values
        if (isNaN(start) || isNaN(end) || isNaN(duration) || !element || !originalText) {
            console.warn('Invalid parameters for animateCTAStat:', { start, end, duration, element, originalText });
            return;
        }
        
        const startTime = performance.now();
        
        const updateStat = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const currentValue = Math.floor(start + (end - start) * easeOutExpo);
            
            // Check for NaN before updating
            if (isNaN(currentValue)) {
                console.warn('NaN detected in CTA stat animation, stopping');
                return;
            }
            
            // Format based on original text
            if (originalText.includes('M+')) {
                element.textContent = Math.floor(currentValue / 1000000) + 'M+';
            } else if (originalText.includes('K+')) {
                element.textContent = Math.floor(currentValue / 1000) + 'K+';
            } else if (originalText.includes('%')) {
                element.textContent = (currentValue / 100).toFixed(1) + '%';
            } else {
                element.textContent = currentValue.toLocaleString() + '+';
            }
            
            if (progress < 1) {
                requestAnimationFrame(updateStat);
            } else {
                element.textContent = originalText;
            }
        };
        
        requestAnimationFrame(updateStat);
    }

    trackCTAClick(trackingId, event) {
        // Track CTA click (production analytics would go here)
        
        // Add click animation
        const button = event.target;
        button.style.transform = 'scale(0.98)';
        setTimeout(() => {
            button.style.transform = '';
        }, 150);
        
        // You can add real analytics tracking here
        // Example: gtag('event', 'cta_click', { cta_id: trackingId });
    }

    createRippleEffect(e) {
        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        const ripple = document.createElement('span');
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;
        
        button.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    highlightStatBadge(badge) {
        badge.style.transform = 'translateY(-8px) scale(1.05)';
        badge.style.background = 'rgba(255, 255, 255, 0.2)';
    }

    unhighlightStatBadge(badge) {
        badge.style.transform = '';
        badge.style.background = '';
    }

    /**
     * Initialize Performance Optimizations
     */
    initPerformanceOptimizations() {
        this.initCriticalResourceLoading();
        this.initLazyComponents();
        this.initIntersectionObservers();
        this.initPreloadLinks();
    }

    initCriticalResourceLoading() {
        // Mark above-fold content
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) {
            heroSection.classList.add('above-fold');
        }
        
        // Mark below-fold content for lazy loading
        const sections = document.querySelectorAll('section:not(.hero-section)');
        sections.forEach(section => {
            section.classList.add('below-fold');
        });
        
        // Preload critical fonts
        const fontPreload = document.createElement('link');
        fontPreload.rel = 'preload';
        fontPreload.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
        fontPreload.as = 'style';
        fontPreload.onload = function() { this.onload = null; this.rel = 'stylesheet'; };
        document.head.appendChild(fontPreload);
    }

    initLazyComponents() {
        const lazyElements = document.querySelectorAll('.lazy-load');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.1
        });
        
        lazyElements.forEach(element => {
            observer.observe(element);
        });
    }

    initIntersectionObservers() {
        // Optimize existing observers for performance
        this.optimizeScrollAnimations();
        this.initVisibilityTracking();
    }

    optimizeScrollAnimations() {
        // Throttle scroll events
        let ticking = false;
        
        const updateAnimations = () => {
            // Update any scroll-based animations here
            ticking = false;
        };
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateAnimations);
                ticking = true;
            }
        }, { passive: true });
    }

    initVisibilityTracking() {
        // Track section visibility for analytics
        const sections = document.querySelectorAll('section[id]');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionName = entry.target.id || entry.target.className;
                    this.trackSectionView(sectionName);
                }
            });
        }, {
            threshold: 0.5
        });
        
        sections.forEach(section => observer.observe(section));
    }

    trackSectionView(sectionName) {
        // Analytics tracking (replace with your analytics service)
        if (typeof gtag !== 'undefined') {
            gtag('event', 'section_view', {
                section_name: sectionName,
                timestamp: Date.now()
            });
        }
    }

    initPreloadLinks() {
        // Preload important resources
        const preloadResources = [
            { href: '../css/variables.css', as: 'style' },
            { href: 'css/landing.css', as: 'style' },
            { href: 'js/landing.js', as: 'script' }
        ];
        
        preloadResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.as;
            document.head.appendChild(link);
        });
    }

    /**
     * Initialize Accessibility Enhancements
     */
    initAccessibility() {
        this.initScreenReaderSupport();
        this.initKeyboardNavigation();
        this.initFocusManagement();
        this.initReducedMotionSupport();
        this.initColorContrastEnhancements();
    }

    initScreenReaderSupport() {
        // Create live region for announcements
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.setAttribute('class', 'sr-only');
        liveRegion.id = 'live-region';
        document.body.appendChild(liveRegion);
        
        // Add semantic landmarks
        this.addLandmarkRoles();
        
        // Enhance form labels
        this.enhanceFormAccessibility();
    }

    addLandmarkRoles() {
        const nav = document.querySelector('nav');
        if (nav) nav.setAttribute('role', 'navigation');
        
        const main = document.querySelector('main') || document.querySelector('.hero-section').parentNode;
        if (main) main.setAttribute('role', 'main');
        
        const sections = document.querySelectorAll('section');
        sections.forEach(section => {
            if (!section.getAttribute('role')) {
                section.setAttribute('role', 'region');
            }
        });
    }

    enhanceFormAccessibility() {
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
                const label = document.querySelector(`label[for="${input.id}"]`) || 
                            input.closest('label') || 
                            input.previousElementSibling;
                
                if (label && label.textContent) {
                    input.setAttribute('aria-label', label.textContent.trim());
                }
            }
        });
    }

    initKeyboardNavigation() {
        // Add skip links
        this.addSkipLinks();
        
        // Enhance tab navigation
        this.enhanceTabNavigation();
        
        // Add keyboard shortcuts
        this.addKeyboardShortcuts();
    }

    addSkipLinks() {
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.textContent = 'Skip to main content';
        skipLink.className = 'skip-link sr-only-focusable';
        skipLink.style.cssText = `
            position: absolute;
            top: -40px;
            left: 6px;
            background: var(--accent-violet);
            color: white;
            padding: 8px 16px;
            text-decoration: none;
            border-radius: 4px;
            z-index: 10000;
            transition: top 0.3s;
        `;
        
        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '6px';
        });
        
        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-40px';
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
    }

    enhanceTabNavigation() {
        // Ensure proper tab order
        const focusableElements = document.querySelectorAll(`
            a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])
        `);
        
        focusableElements.forEach((element, index) => {
            if (!element.getAttribute('tabindex')) {
                element.setAttribute('tabindex', '0');
            }
        });
    }

    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Alt + H: Go to home
            if (e.altKey && e.key === 'h') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                this.announceToScreenReader('Navigated to top of page');
            }
            
            // Alt + F: Focus on first CTA button
            if (e.altKey && e.key === 'f') {
                e.preventDefault();
                const firstCTA = document.querySelector('.cta-primary');
                if (firstCTA) {
                    firstCTA.focus();
                    this.announceToScreenReader('Focused on primary call-to-action');
                }
            }
            
            // Alt + M: Focus on navigation menu
            if (e.altKey && e.key === 'm') {
                e.preventDefault();
                const nav = document.querySelector('nav a');
                if (nav) {
                    nav.focus();
                    this.announceToScreenReader('Focused on navigation menu');
                }
            }
        });
    }

    initFocusManagement() {
        // Trap focus in modals
        this.initModalFocusTrap();
        
        // Manage focus for dynamic content
        this.initDynamicFocusManagement();
    }

    initModalFocusTrap() {
        const modals = document.querySelectorAll('.modal, [role="dialog"]');
        
        modals.forEach(modal => {
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    const focusableElements = modal.querySelectorAll(`
                        a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])
                    `);
                    
                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];
                    
                    if (e.shiftKey) {
                        if (document.activeElement === firstElement) {
                            e.preventDefault();
                            lastElement.focus();
                        }
                    } else {
                        if (document.activeElement === lastElement) {
                            e.preventDefault();
                            firstElement.focus();
                        }
                    }
                }
            });
        });
    }

    initDynamicFocusManagement() {
        // Focus management for dynamically loaded content
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const focusableElement = node.querySelector('[autofocus]') || 
                                                   node.querySelector('button, a, input');
                            if (focusableElement) {
                                setTimeout(() => focusableElement.focus(), 100);
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }

    initReducedMotionSupport() {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        const handleReducedMotion = (e) => {
            if (e.matches) {
                document.body.classList.add('reduced-motion');
                this.disableAnimations();
            } else {
                document.body.classList.remove('reduced-motion');
                this.enableAnimations();
            }
        };
        
        handleReducedMotion(prefersReducedMotion);
        prefersReducedMotion.addEventListener('change', handleReducedMotion);
    }

    disableAnimations() {
        const style = document.createElement('style');
        style.id = 'reduced-motion-styles';
        style.textContent = `
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
                scroll-behavior: auto !important;
            }
        `;
        document.head.appendChild(style);
    }

    enableAnimations() {
        const style = document.getElementById('reduced-motion-styles');
        if (style) {
            style.remove();
        }
    }

    initColorContrastEnhancements() {
        // Check for high contrast preference
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
        
        const handleHighContrast = (e) => {
            if (e.matches) {
                document.body.classList.add('high-contrast');
            } else {
                document.body.classList.remove('high-contrast');
            }
        };
        
        handleHighContrast(prefersHighContrast);
        prefersHighContrast.addEventListener('change', handleHighContrast);
    }

    announceToScreenReader(message) {
        const liveRegion = document.getElementById('live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
            
            // Clear after announcing
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    }
}

/**
 * Enhanced scroll reveal animations
 */
class ScrollReveal {
    constructor() {
        this.elements = document.querySelectorAll('[data-reveal]');
        this.init();
    }

    init() {
        const options = {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.revealElement(entry.target);
                    this.observer.unobserve(entry.target);
                }
            });
        }, options);

        this.elements.forEach(el => {
            this.observer.observe(el);
        });
    }

    revealElement(element) {
        const delay = element.dataset.delay || 0;
        
        setTimeout(() => {
            element.classList.add('revealed');
        }, delay);
    }
}

/**
 * Lazy loading for images and heavy content
 */
class LazyLoader {
    constructor() {
        this.images = document.querySelectorAll('img[data-lazy]');
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        imageObserver.unobserve(entry.target);
                    }
                });
            });

            this.images.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback for older browsers
            this.images.forEach(img => this.loadImage(img));
        }
    }

    loadImage(img) {
        img.src = img.dataset.lazy;
        img.classList.add('loaded');
    }
}

/**
 * Initialize everything when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize main landing page functionality
    window.landingPage = new LandingPage();
    
    // Initialize additional features
    new ScrollReveal();
    new LazyLoader();
    
    // Add loading class removal
    document.body.classList.add('loaded');
});

/**
 * Handle page visibility changes for performance
 */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause animations when page is not visible
        document.querySelectorAll('.floating-shape').forEach(shape => {
            shape.style.animationPlayState = 'paused';
        });
    } else {
        // Resume animations when page becomes visible
        document.querySelectorAll('.floating-shape').forEach(shape => {
            shape.style.animationPlayState = 'running';
        });
    }
});

/**
 * Export for module usage
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LandingPage, ScrollReveal, LazyLoader };
}