"""
 ---------------------------------------------------------------------------------
 shine - [s]erver [h]osted [i]ntelligent [n]eural-net [e]nvironment :)
 ---------------------------------------------------------------------------------

 by Code Sourcerer
 (c) 2017 ducandu GmbH
"""

# "global" classes (that should live in the ai. namespace directly)
from aiopening.labs import Lab
from aiopening.experiments import Experiment
from aiopening.models import Model

# make sure these are available without having to specify them as separate imports
import aiopening.modules
import aiopening.envs
import aiopening.algorithms

# global pack vars
_VERSION = 1  # 00.00.01 = 1

