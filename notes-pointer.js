/**
 * Handles opening of and synchronization with the reveal.js
 * notes window.
 *
 * Handshake process:
 * 1. This window posts 'connect' to notes window
 *    - Includes URL of presentation to show
 * 2. Notes window responds with 'connected' when it is available
 * 3. This window proceeds to send the current presentation state
 *    to the notes window
 */
var RevealNotes = (function() {

    /**
     * Default values for options (and also hash of available pointers)
     */
    var DEFAULT_OPTIONS = {
        'pointer': {
            color: 'rgba(255, 0, 0, 0.8)',
            key: 'A',
            'createPointer': function(slides, id, options) {
                var dimension = 20
                var disk = document.createElement('div');
                disk.style.position = 'absolute';
                disk.style.width = dimension + 'px';
                disk.style.height = dimension + 'px';
                disk.style.marginLeft = '-' + Math.round(dimension / 2) + 'px';
                disk.style.marginTop = '-' + Math.round(dimension / 2) + 'px';
                disk.style.borderRadius = '50%';
                disk.style.zIndex = 20;
                disk.style.display = 'none';
                disk.dataset.id = id
                disk.style.backgroundColor = options.color;
                return disk;
            },
            'applyMove': function(disk, x, y) {
                disk.style.left = x + 'px';
                disk.style.top = y + 'px';
            }
        },
        'spotlight': {
            key: 'Z',
            'createPointer': function(slides, id, options) {
                var dimension = 100
                var disk = document.createElement('div');
                disk.style.position = 'absolute';
                disk.style.position = 'fixed';
                disk.style.width = '100%';
                disk.style.height = '100%';
                disk.style.left= '0';
                disk.style.top= '0';
                disk.style.zIndex = 20;
                disk.style.display = 'none';
                disk.style['background'] = "radial-gradient(circle, rgba(255,255,255,0) 0%, rgba(0,0,0,1) 100%) no-repeat"
                disk.dataset.id = id
                return disk;
            },
            'applyMove': function(disk, x, y) {
                disk.style['background'] = 'radial-gradient(circle at '+x+'px '+y+'px, '+
                    'rgba(255,255,255,0) 0%, '+
                    'rgba(0,0,0,1) 100%) no-repeat'
            }
        }
    }

    var config = Reveal.getConfig();
    var options = config.notes_pointer || {};
    var notes_options = options.notes || {};

    var notesPopup = null;

    function addKeyBinding(key, keyCode, defaultKey, description, binding) {
        if (key === undefined && keyCode === undefined) {
            key = defaultKey;
        }

        if (keyCode === undefined) {
            keyCode = key.toUpperCase().charCodeAt(0);
        } else if (key === undefined) {
            key = String.fromCharCode(keyCode);
        }

        Reveal.addKeyBinding({keyCode: keyCode, key: key, description: description}, binding);
    }


    function openNotes( notesFilePath ) {

        if (notesPopup && !notesPopup.closed) {
            notesPopup.focus();
            return;
        }

        if( !notesFilePath ) {
            var jsFileLocation = document.querySelector('script[src$="notes-pointer.js"]').src;  // this js file path
            jsFileLocation = jsFileLocation.replace(/notes-pointer\.js(\?.*)?$/, '');   // the js folder path
            notesFilePath = jsFileLocation + 'notes.html';
        }

        notesPopup = window.open( notesFilePath, 'reveal.js - Notes', 'width=1100,height=700' );

        if( !notesPopup ) {
            alert( 'Speaker view popup failed to open. Please make sure popups are allowed and reopen the speaker view.' );
            return;
        }

        /**
         * Connect to the notes window through a postmessage handshake.
         * Using postmessage enables us to work in situations where the
         * origins differ, such as a presentation being opened from the
         * file system.
         */
        function connect() {
            // Keep trying to connect until we get a 'connected' message back
            var connectInterval = setInterval( function() {
                notesPopup.postMessage( JSON.stringify( {
                    namespace: 'reveal-notes',
                    type: 'connect',
                    url: window.location.protocol + '//' + window.location.host + window.location.pathname + window.location.search,
                    state: Reveal.getState()
                } ), '*' );
            }, 500 );

            window.addEventListener( 'message', function( event ) {
                var data = JSON.parse( event.data );
                if( data && data.namespace === 'reveal-notes' && data.type === 'connected' ) {
                    clearInterval( connectInterval );
                    onConnected();
                }
                if( data && data.namespace === 'reveal-notes' && data.type === 'call' ) {
                    callRevealApi( data.methodName, data.arguments, data.callId );
                }
            } );
        }

        /**
         * Calls the specified Reveal.js method with the provided argument
         * and then pushes the result to the notes frame.
         */
        function callRevealApi( methodName, methodArguments, callId ) {

            var result = Reveal[methodName].apply( Reveal, methodArguments );
            notesPopup.postMessage( JSON.stringify( {
                namespace: 'reveal-notes',
                type: 'return',
                result: result,
                callId: callId
            } ), '*' );

        }

        /**
         * Posts the current slide data to the notes window
         */
        function post( event ) {

            var slideElement = Reveal.getCurrentSlide(),
                notesElement = slideElement.querySelector( 'aside.notes' ),
                fragmentElement = slideElement.querySelector( '.current-fragment' );

            var messageData = {
                namespace: 'reveal-notes',
                type: 'state',
                notes: '',
                markdown: false,
                whitespace: 'normal',
                state: Reveal.getState()
            };

            // Look for notes defined in a slide attribute
            if( slideElement.hasAttribute( 'data-notes' ) ) {
                messageData.notes = slideElement.getAttribute( 'data-notes' );
                messageData.whitespace = 'pre-wrap';
            }

            // Look for notes defined in a fragment
            if( fragmentElement ) {
                var fragmentNotes = fragmentElement.querySelector( 'aside.notes' );
                if( fragmentNotes ) {
                    notesElement = fragmentNotes;
                }
                else if( fragmentElement.hasAttribute( 'data-notes' ) ) {
                    messageData.notes = fragmentElement.getAttribute( 'data-notes' );
                    messageData.whitespace = 'pre-wrap';

                    // In case there are slide notes
                    notesElement = null;
                }
            }

            // Look for notes defined in an aside element
            if( notesElement ) {
                messageData.notes = notesElement.innerHTML;
                messageData.markdown = typeof notesElement.getAttribute( 'data-markdown' ) === 'string';
            }

            notesPopup.postMessage( JSON.stringify( messageData ), '*' );

        }


        /**
         * Called once we have established a connection to the notes
         * window.
         */
        function onConnected() {

            // Monitor events that trigger a change in state
            Reveal.addEventListener( 'slidechanged', post );
            Reveal.addEventListener( 'fragmentshown', post );
            Reveal.addEventListener( 'fragmenthidden', post );
            Reveal.addEventListener( 'overviewhidden', post );
            Reveal.addEventListener( 'overviewshown', post );
            Reveal.addEventListener( 'paused', post );
            Reveal.addEventListener( 'resumed', post );

            // Post the initial state
            post();

        }

        connect();

    }


    var RevealPointer = (function() {
        var body = document.querySelector('body');
        var slides = document.querySelector('.slides');

        var Pointer = function(id, options) {
            this.isPointing = false;
            this.callbackSet = false;
                /** config defined by user, which contains all useful informations */
            this.options = options;
            /** id given by config index, allowing later lookup */
            this.id = id
            this.pointer = options.createPointer(slides, id, options)
            this.applyMove = options.applyMove
            slides.appendChild(this.pointer);
            addKeyBinding(options.key, options.keyCode, options.key,
                'Toggle '+id, 
                // Seems like modern JS magic ! https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
                this.toggle.bind(this));
            // Exposed functions ids
            this.exposedPoint = 'point'+id
            this.exposedToggle = 'toggle'+id
            // And made a binding for tracker to keep context
            this.tracker = this.trackMouse.bind(this)
        }

        Pointer.prototype.showPointer = function () {
            this.pointer.style.display = 'block';
        }

        Pointer.prototype.hidePointer = function() {
            this.pointer.style.display = 'none';
        }

        Pointer.prototype.pointerOn = function() {
            this.showPointer();
            body.style.cursor = 'none';
            if( !this.callbackSet ) {
                document.addEventListener('mousemove', this.tracker);
                this.callbackSet = true;
            }
            this.isPointing = true;
        }

        Pointer.prototype.pointerOff = function() {
            this.hidePointer();
            body.style.cursor = 'auto';
            if( this.callbackSet ) {
                document.removeEventListener('mousemove', this.tracker);
                this.callbackSet = false;
            }
            this.isPointing = false;
            this.postPointer(0, 0, {"pointer":this.id, "active":false});
        }

        Pointer.prototype.toggle = function(e) {
            if (this.isPointing) {
                this.pointerOff();
            } else {
                this.pointerOn();
            }
        }

        Pointer.prototype.trackMouse = function(e) {
                // compute x, y positions relative to slides element in unscaled coords
                var slidesRect = slides.getBoundingClientRect();
                var slides_left = slidesRect.left, slides_top = slidesRect.top;
                if (slides.style.zoom) {  // zoom is weird.
                    slides_left *= slides.style.zoom;
                    slides_top *= slides.style.zoom;
                }

                var scale = Reveal.getScale();
                var offsetX = (e.clientX - slides_left) / scale;
                var offsetY = (e.clientY - slides_top) / scale;

                state = {"pointer":this.id, "active":true}
                this.point(offsetX, offsetY, state);
                this.postPointer(offsetX, offsetY, state);
        }

        Pointer.prototype.point = function(x, y, state) {
            if (state.active||false === true) {
                this.showPointer();
            } else {
                this.hidePointer();
            }

            // x, y are in *unscaled* coordinates
            this.applyMove(this.pointer, x, y)
        }

        Pointer.prototype.postPointer = function(x, y, state) {
            var message = {
                type: 'point',
                x: x,
                y: y,
                state: state
            }
            var receiver = null
            if (notesPopup) {
                message = Object.assign(message, {namespace: 'reveal-notes'})
                receiver = notesPopup
            } else if (Reveal.getConfig().postMessageEvents && window.parent !== window.self) {
                message = Object.assign(message, {namespace: 'reveal'})
                receiver = window.parent;
            }
            var stringified = JSON.stringify(message)
            console.info("posting message", message, "in string", stringified)
            receiver.postMessage(stringified, '*');
        }

        Pointer.prototype.getExposedFunctions = function() {
            var returned = {}
            returned[this.exposedPoint]  =this.point.bind(this)
//            returned['point'] = this.point.bind(this)
            returned[this.exposedToggle] = this.toggle.bind(this)
//            returned['toggle'] = this.toggle.bind(this)
            return returned
        }

        /** The usable pointers */
        var pointers ={};

        /* The exposed functions, usable by Reveal API */
        var exported = {}

        // Fill the pointers with the ones read from config
        for(var optionName in DEFAULT_OPTIONS) {
            var optionsFor = DEFAULT_OPTIONS[optionName]
            if(options.hasOwnProperty(optionName)) {
                optionsFor = Object.assign({}, optionsFor, options[optionName])
            }
            // Declaring the pointer does everything : registering keybindings and functions !
            pointers[optionName] = new Pointer(optionName, optionsFor)
            exported = Object.assign(exported, pointers[optionName].getExposedFunctions())
        }


        return exported;
    })();

    // add a Reveal.point API function, so postMessage can handle it
    for(var functionName in RevealPointer) {
        Reveal[functionName] = RevealPointer[functionName];
        console.info("adding function "+functionName)
    }

    Reveal["point"] = function(x, y, state) {
        RevealPointer["point"+state.pointer](x, y, state)
    }

    // patch in Reveal.getSlidesAttributes, in dev branch but not in 3.7.0
    if( !Reveal.getSlidesAttributes ) {
        Reveal.getSlidesAttributes = function() {
            return Reveal.getSlides().map( function( slide ) {

                var attributes = {};
                for( var i = 0; i < slide.attributes.length; i++ ) {
                    var attribute = slide.attributes[ i ];
                    attributes[ attribute.name ] = attribute.value;
                }
                return attributes;

            } );

        }
    }


    if( !/receiver/i.test( window.location.search ) ) {

        // If the there's a 'notes' query set, open directly
        if( window.location.search.match( /(\?|\&)notes/gi ) !== null ) {
            openNotes();
        }

        // Open the notes when the 's' key is hit
        addKeyBinding(notes_options.key, notes_options.keyCode, 'S',
                      'Speaker notes view', function() { openNotes(); });
    }

    return { open: openNotes, RevealPointer: RevealPointer };
})();
