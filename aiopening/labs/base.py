"""                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           ""
 -------------------------------------------------------------------------
 AIOpening - labs/base.py

 A Lab always contains setup and config parameters about the execution
 environment (in which Experiments are run). This config contains for example:
 how many CPUs/GPUs, server address (or local) etc..
 A Lab can contain one or more Experiment objects.
 A Lab itself is always handled and run locally, whereas Experiment
 objects in the lab can be run locally or remotely (on the Lab's server).

 created: 2017/09/01 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""

from aiopening.experiments import Experiment


class Lab(object):
    """
    A Lab is a container class for one or more experiments.
    The Lab allows researchers to setup, run, pause, stop, save, load experiments.
    Also contains all functionalities and configurations to run experiments in the cloud (e.g. AWS ec2 entities)
    """
    def __init__(self, config):
        self.config = config or {}  # this is a dict specific key/value pairs that together make up a lab config
        # TODO: handle config
        self.config["num_cpus"] = 1
        self.config["location"] = "local"
        self._experiments = {}  # a dict of all experiments (by name) that live in this Lab

    def add_experiment(self, experiment):
        assert experiment.name not in self._experiments, "ERROR: Experiment with name {} already in our experiments dict!".format(experiment.name)
        assert isinstance(experiment, Experiment), "ERROR: Given experiment is not of type ai.Experiment (but of type: {})!".\
            format(type(experiment).__name__)
        self._experiments[experiment.name] = experiment

    def get_experiment(self, name):
        assert name in self._experiments, "ERROR: Experiment with name {} not in our experiments dict!".format(name)
        return self._experiments[name]

    def load_experiment(self, name, version=None, dont_add=False):
        """
        Loads a previously stored Experiment from disk and adds it to the Lab (unless dont_add=True).

        :param str name: The name of the experiment to load.
        :param str version: The version of the experiment to load from disk. None: use latest version.
        :param bool dont_add: If True, the Experiment is only returned to the caller, but not added to the Lab.
        :return: The loaded experiment
        :rtype: Experiment
        """
        raise NotImplementedError
