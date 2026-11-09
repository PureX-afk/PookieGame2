Sound effects
=============

One-shot recordings played through the shared sound-effects bus, which is the bus the
Settings > Volume > Sound effects slider controls.

fishing-rod-cast.mp3
--------------------
- 4.3 s, stereo MP3 (48 KB), a little over a second of which is silence at the start.
- Plays once when a cast is released and the bobber leaves the rod.
- Playback is trimmed to 1.44-2.70 s: the leading silence is skipped so the whoosh lands
  with the throw instead of after it, and only the start of the tail is kept. The last
  0.45 s fades out, so about 1.25 s of sound plays and ends before the bobber's wait.

fish-bite.mp3
-------------
- 0.6 s, stereo MP3 (8 KB), silent for its first 0.15 s.
- Plays once the float goes under, at the same moment the bobber starts shaking and the
  pad rumbles, so a bite is heard as well as seen.
- Playback is trimmed to 0.14-0.55 s (about 0.4 s) with a 40 ms fade-out. The recording
  peaks at nearly full scale, so it plays at 0.9 gain to keep a little headroom.

fishing-jingle.wav
------------------
- 0.38 s, stereo PCM WAV (65 KB), converted from the user's Stardew Valley jingle.
- Plays once when a fish is caught, during the short pause before it leaps to the angler.
- Normalized to a 0.5 peak and played whole with a 40 ms fade-out.

These effects are panned slightly toward their angler (left for player one, right for
player two) so they read directionally with two people on one screen. They are fetched
with the game and decoded when the session starts; a sound requested before decoding
finishes is silent rather than delayed.
