<img src="https://github.com/sven1977/aiopening/blob/master/logo.png" width="50">

# aiopening
<b>opening up AI - unleash the fury :)</b>

aiopening is a Python library for games and reinforcement learning (RL) algorithms with focus on deep-neural-nets and deep-RL.
Games are defined as simple tmx files and each level of the game can be interpreted as a single MDP (see RL) that needs to be solved. aiopening comes with it's own 2D game engine ("spygame") written against Pygame.
There will also be an MDP-solver-server (to solve the levels of different games) and a command line client, through which one can upload game/levels/MDPs to the server for MDP-solver jobs.

## who should use aiopening?
<b>Answer</b>: people who ...
- are interested in RL algorithm research
- would like to test their ideas on simple 2D game environments (MDPs), which you can create using only a tiled map (tmx file)
- would like to have the aiopening server try different algorithms and hyperparameters automatically on given MDPs and return the best solutions

# Apex Unleash Project
great things are about to come

## How to setup your environment to run experiments in aiopening on Win10
1) Install Anaconda3 (Python 3.6 version) on your PC

https://www.anaconda.com/download/

2) Open an "Anaconda Prompt" from your Win start menu
3) Create a new env and call it "rllab" by typing:

``>conda create -n aiopening python=3.6 numpy``

4) Switch into the newly created `aiopening` env:

``>activate aiopening``

5) Install pygame
    - download the Windows wheel from http://www.lfd.uci.edu/~gohlke/pythonlibs/
    (pygame‑1.9.3‑cp36‑cp36m‑win_amd64.whl)
    - and install it into the still activated `aiopening` Anaconda env via:

``>pip install [path to pygame‑1.9.3‑cp36‑cp36m‑win_amd64.whl]``


6) If your PC has a Nvidia GPU, follow the tensorflow GPU installation
procedure here first (skipping everything from "Install Anaconda" on:
https://nitishmutha.github.io/tensorflow/2017/01/22/TensorFlow-with-gpu-for-windows.html

7) Install the tensorflow package into our still active `aiopening` Anaconda env via:

``>conda install tensorflow-gpu``

8) Test your new tensorflow-gpu installation:

```
>python
...
>>> import tensorflow as tf
>>> sess = tf.Session(config=tf.ConfigProto(log_device_placement=True))
```

Check the printout after running the last command for things like:
"(/gpu:0) -> (device: 0, name: GeForce GTX 980 ..."
The name of your GPU may vary depending on your Nvidia GPU type.

9) Clone the sonnet source into your aiopening env:
- `git clone http://github.com/deepmind/sonnet`
- Rename setup.py.temp into setup.py
- Change the line project_name = '%%%PROJECT_NAME%%%' to project_name = 'dm-sonnet-gpu'
- Rename the BUILD file into BUILD_test
- Now try it: `python setup.py install` (this should do a basic Win10 install (no C++ code compiled))

10) WIP: Not done yet. More instructions to follow.
...