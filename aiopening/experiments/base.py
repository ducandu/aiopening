"""
 -------------------------------------------------------------------------
 AIOpening - experiments/base.py
 
 An Experiment lives in a Lab object and can be saved and shared between
 different (and differently setup) Lab objects.
 An Experiment is a collection of algorithms, data storages, models, and
 environments.
 Experiments can be run (in the background), paused, stopped, saved,
 loaded, etc.. in that lab.

 created: 2017/09/01 in PyCharm
 (c) 2017 Sven - ducandu GmbH
 -------------------------------------------------------------------------
"""


class Experiment(object):
    """
    An Experiment contains algos, models, settings and methods to control the execution of algos and the training of the models.
    """
    def __init__(self, **kwargs):
        """
        :param any kwargs: setup parameters for the experiment
        TODO:
        """
        self.mode = kwargs.get("mode", "local")
        self.num_cpus = kwargs.get("num_cpus", 1)
        self.algorithms = kwargs.get("algorithms", {})  # stores all algorithms by name
        self.models = kwargs.get("models", {})  # store our models by name

    def add_algo(self, algo):
        assert algo.name not in self.algorithms
        self.algorithms[algo.name] = algo

    def start(self):
        """
        Starts an experiment or adds a new one and then starts that.
        The Experiment's configuration values overwrite those of the Lab (e.g. num_cpus, etc..)
        Experiments run in the background, spawning off a new process (possibly multithreaded itself), and can later be paused, stopped,
        waited for, saved, then loaded and rerun or continued.

        :param experiment:
        :return:
        :rtype:
        """
        raise NotImplementedError

    def pause(self):
        raise NotImplementedError

    def save(self):
        """
        Saves an Experiment to disk using the Lab's folder and the Experiment's name (bumps the version of the experiment's file by one).

        :param str name: The name of the experiment to be saved.
        :return:
        :rtype:
        """
        raise NotImplementedError
