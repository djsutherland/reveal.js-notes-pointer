A fork of [the default reveal.js notes plugin](https://github.com/hakimel/reveal.js/tree/master/plugin/notes) where you can use your mouse to point, as if with a laser pointer, in the notes preview window and have it show up in the presentation window.

Usage: `npm install reveal.js-notes-pointer`, and then

```
Reveal.initialize({
    // ...

    // Optional configuration, leave anything out for defaults
    notes_pointer: {
        pointer: {
            size: 15,  // in pixels (scaled like the rest of reveal.js)
            color: 'rgba(255, 0, 0, 0.8)',  // something valid for css background-color
            key: 'A'
        },
		spotlight: {
            borderColor: 'rgba(34,34,34, 1)', // color at screen border (use your background color with full opacity)
            edgeColor: 'rgba(34,34,34, 0.8)', // color at spotlight edge (use your background color with a nice alpha)
            centerColor: 'rgba(0, 255, 0, 0)', // color at spotlight center (this one should be transparent)
            key: 'Z',
            size: 100, // size of spotlight
        }
        notes: {
            key: 'S'
        }
    },

    dependencies: [
        // ...

        {src: 'node_modules/reveal.js-notes-pointer/notes-pointer.js', async: True}
        // async is optional
    ]
});
```


Some inspiration from [`caiofcm/plugin-revealjs-mouse-pointer`](https://github.com/caiofcm/plugin-revealjs-mouse-pointer).
