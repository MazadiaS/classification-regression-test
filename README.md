# Classification vs Regression Test

Static quiz site. Open `index.html`, or see the GitHub Pages deployment.

## Version 2 (30 questions)

The live quiz loads `questions_v2.json`. The original 32-question `questions.json` is kept unchanged.

v2 is generated. Do not edit the JSON by hand: change `tools/source_v2.py` (the correct option is written first there), then run:

```
python3 tools/build_v2.py
```

The build places the answers so A–D are balanced, with no more than 2 of the same letter in a row. It fails if any answer cue appears: the correct option being the longest or the shortest more often than chance, option lengths that differ a lot within one question, or words like always/never/only that appear only in wrong options.
