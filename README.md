<img src="https://raw.githubusercontent.com/ducandu/aiopening/master/logo.png" width=75 height=75><img src="https://raw.githubusercontent.com/ducandu/aiopening/master/logo.png" width=75 height=75><br>

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\\-------/<br/>

# aiopening
<b>opening up AI - unleash the fury :)</b>

aiopening is a Python library for games and reinforcement learning (RL) algorithms with focus on deep-neural-nets and deep-RL.

## who should use aiopening?
<b>Answer</b>: people who ...
- are interested in RL algorithm research
- are interested in applying RL algorithms to solve computer game related problems


# Apex Unleash Project
great things are about to come

## How to setup your environment to run experiments in aiopening on Win10

aiopening only depends on the python3 libs: tensorflow/tensorflow-gpu
and deepmind's sonnet library. Here is how to get setup with aiopening:

1) Install Anaconda3 (Python 3.6 version) on your PC

https://www.anaconda.com/download/

2) Open an "Anaconda Prompt" from your Win start menu
3) Create a new env and call it "aiopening" by typing:

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

Check the printout after running the last command for mentions of:
"(/gpu:0) -> (device: 0, name: GeForce GTX 980 ..."<br/>
**NOTE:** The name of your GPU may vary depending on your Nvidia GPU type.

9) Manually install deepmind's sonnet library in your aiopening env<br/>
dm-sonnet is based on tensorflow and makes it very easy to build simple
sub modules (e.g. a ConvNet unit) and then plug-and-play these modules to create
larger and more complex NN topologies.

- While still in your conda env named `aiopening`:
do a `cd [any directory of your choice]`
- `git clone http://github.com/deepmind/sonnet` or download and unzip
sonnet directly from github: https://github.com/deepmind/sonnet/
- Rename setup.py.temp into setup.py
- In `setup.py`, change the line `project_name = '%%%PROJECT_NAME%%%'` to
`project_name = 'dm-sonnet-gpu'`
- Rename the `BUILD` file into `BUILD_test`
- Now try in the directory of the `setup.py` file: `python setup.py install`.
This should do a basic Win10 install (no C++ code compiled).

10) WIP: Not done yet. More instructions to follow on how to install
`aiopening` itself
...