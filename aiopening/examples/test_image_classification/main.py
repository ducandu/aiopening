

from urllib.request import urlretrieve
from os.path import isfile, isdir
from tqdm import tqdm
import problem_unittests as tests
import tarfile

cifar10_dataset_folder_path = 'cifar-10-batches-py'

class DLProgress(tqdm):
    last_block = 0

    def hook(self, block_num=1, block_size=1, total_size=None):
        self.total = total_size
        self.update((block_num - self.last_block) * block_size)
        self.last_block = block_num

if not isfile('cifar-10-python.tar.gz'):
    with DLProgress(unit='B', unit_scale=True, miniters=1, desc='CIFAR-10 Dataset') as pbar:
        urlretrieve(
            'https://www.cs.toronto.edu/~kriz/cifar-10-python.tar.gz',
            'cifar-10-python.tar.gz',
            pbar.hook)

if not isdir(cifar10_dataset_folder_path):
    with tarfile.open('cifar-10-python.tar.gz') as tar:
        tar.extractall()
        tar.close()


tests.test_folder_path(cifar10_dataset_folder_path)


# ## Explore the Data
# The dataset is broken into batches to prevent your machine from running out of memory.  The CIFAR-10 dataset consists of 5 batches, named `data_batch_1`, `data_batch_2`, etc.. Each batch contains the labels and images that are one of the following:
# * airplane
# * automobile
# * bird
# * cat
# * deer
# * dog
# * frog
# * horse
# * ship
# * truck
# 
# Understanding a dataset is part of making predictions on the data.  Play around with the code cell below by changing the `batch_id` and `sample_id`. The `batch_id` is the id for a batch (1-5). The `sample_id` is the id for a image and label pair in the batch.
# 
# Ask yourself "What are all possible labels?", "What is the range of values for the image data?", "Are the labels in order or random?".  Answers to questions like these will help you preprocess the data and end up with better predictions.

# In[2]:


#get_ipython().magic('matplotlib inline')
#get_ipython().magic("config InlineBackend.figure_format = 'retina'")

import helper
import numpy as np

# Explore the dataset
batch_id = 4
sample_id = 222
#helper.display_stats(cifar10_dataset_folder_path, batch_id, sample_id)


# In[3]:


import pickle
def load_cfar10_batch(cifar10_dataset_folder_path, batch_id):
    """
    Load a batch of the dataset
    """
    with open(cifar10_dataset_folder_path + '/data_batch_' + str(batch_id), mode='rb') as file:
        batch = pickle.load(file, encoding='latin1')

    features = batch['data'].reshape((len(batch['data']), 3, 32, 32)).transpose(0, 2, 3, 1)
    labels = batch['labels']

    return features, labels


# In[4]:


# check value range of data
features, labels = load_cfar10_batch(cifar10_dataset_folder_path, batch_id)
print("min value: {:d} max value: {:d}".format(features.min(), features.max()))


# ## Implement Preprocess Functions
# ### Normalize
# In the cell below, implement the `normalize` function to take in image data, `x`, and return it as a normalized Numpy array. The values should be in the range of 0 to 1, inclusive.  The return object should be the same shape as `x`.

# In[5]:


#def normalize(x):
#    """
#    Normalize a list of sample image data in the range of 0 to 1
#    : x: List of image data.  The image shape is (32, 32, 3)
#    : return: Numpy array of normalize data
#    """
#    # TODO: Implement Function
#    normalizer = lambda n: n/255
#    return np.vectorize normalizer

# do this in one line instead with a lambda and numpy's great vectorize function :)
normalize = np.vectorize(lambda i: i/255)




# ### One-hot encode
# Just like the previous code cell, you'll be implementing a function for preprocessing.  This time, you'll implement the `one_hot_encode` function. The input, `x`, are a list of labels.  Implement the function to return the list of labels as One-Hot encoded Numpy array.  The possible values for labels are 0 to 9. The one-hot encoding function should return the same encoding for each value between each call to `one_hot_encode`.  Make sure to save the map of encodings outside the function.
# 
# Hint: Don't reinvent the wheel.

# In[6]:


def one_hot_encode(x):
    """
    One hot encode a list of sample labels. Return a one-hot encoded vector for each label.
    : x: List of sample Labels
    : return: Numpy array of one-hot encoded labels
    """
    # the return matrix (shape: [num samples x 10 categories])
    ret = np.zeros([len(x), 10], dtype=np.float32)
    for i, label in enumerate(x):
        ret[i][label] = 1 # only set the label/category-slot to 1, leave all others at 0
    return ret




import pickle
import helper

# Load the Preprocessed Validation data
valid_features, valid_labels = pickle.load(open('preprocess_validation.p', mode='rb'))



import importlib
import aiopening as ai
import tensorflow as tf

n_classes = 10

class MyNet(ai.Model):
    def __init__(self, name, num_colors=3, **kwargs):
        super().__init__(name, **kwargs)
        # input depth (the 4th slot of the shape of the input volume (#samples x w x h x in-depth))
        self.num_colors = num_colors

    # have to implement the build method
    # build the entire graph from scratch into the default graph (the call to reset will handle this for us)
    def construct(self):
        # define our three inputs to this graph
        x, y, keep_prob = self.add_feeds((tf.float32, [None, 32, 32, 3], "x"), (tf.float32, [None, n_classes], "y"),
                                        (tf.float32, None, "keep_prob"))
        
        # create the convolutional part
        conv = ai.modules.Convolutional2DNN("convolutional_module",
                                             output_channels=16,
                                             kernel_shapes=(8, 8),
                                             strides=(1, 1),
                                             max_pooling=True,
                                             pool_k_sizes=(2, 2),
                                             pool_strides=(2, 2)
                                            )
        # now conv is an snt.AbstractModule
        conv_out = conv(x)
        # add dropout to conv layer
        conv_out = tf.nn.dropout(conv_out, keep_prob)

        # conv_out is the output of the convolutional part AND input the the next module (flatten)
        flatten = ai.modules.FlattenLayer("flatten_module")
        flatten_out = flatten(conv_out)
        # flatten_out is the output of the flattening operation AND the input to the next module (fully connected)
        fc = ai.modules.FullyConnectedNN("fc_module", [160], activations=[tf.nn.relu])
        fc_out = fc(flatten_out)
        
        fc_end = ai.modules.FullyConnectedNN("logits", [10], activations=None)
        logits = fc_end(fc_out)
        # out are now the logits coming from the last layer
        self._outputs["logits"] = logits

        # Loss and Optimizer
        cost = tf.reduce_mean(tf.nn.softmax_cross_entropy_with_logits(logits=logits, labels=y), name="cost")
        train_op = tf.train.AdamOptimizer().minimize(cost, name="train_op")  # set this model's train operation

        # predictions
        predictions = tf.argmax(logits, 1, name="predictions")  # 1=axis 1 (0 is the batch)

        # Accuracy
        correct_predictions = tf.equal(tf.argmax(logits, 1), tf.argmax(y, 1)) # this will be true or false values
        # casting true/false will result in 0.0/1.0, respectively
        # the mean of these 0.0 or 1.0 over all samples will give the accuracy over all samples
        accuracy = tf.reduce_mean(tf.cast(correct_predictions, tf.float32), name="accuracy")

        self.add_outputs(logits, cost, train_op, predictions, accuracy)

    # question: where is the print-out for the validation accuracy. This value is missing in the entire project.
    # how do we know when to stop training?
    # Also, this function is only called on the last piece of the batch that's being worked on (1 to 5)
    #  so since there are 9000 training samples in a batch and my batch size if 512, this function is only run on the
    #  last 296 samples, which doesn't really make sense. It should be run on the entire training set PLUS on
    #  the validation set separately
    def print_stats(self, session, feature_batch, label_batch):
        """
        Print information about loss and validation accuracy
        : session: Current TensorFlow session
        : feature_batch: Batch of Numpy image data
        : label_batch: Batch of Numpy label data
        : cost: TensorFlow cost function
        : accuracy: TensorFlow accuracy function
        """
        cost_out, acc_out = session.run([self.get_output("cost"), self.get_output("accuracy")],
                                        feed_dict={self.get_feed("x"): feature_batch, self.get_feed("y"): label_batch, self.get_feed("keep_prob"): 1.0})
        ###DEBUG: cost_out, acc_out, logits_out, labels_out = session.run([cost, accuracy, logits, y], feed_dict={x: feature_batch, y: label_batch, keep_prob: 1.0})
        print("Loss: {:.2f} Accuracy: {:.2f}%".format(cost_out, acc_out*100))
    
        #### DEBUG: (had to find out why cost would go down to ~2.3 and accuracy would stay at ~10%, it's because all 10 categories would get 0.1 in the softmax, which is useless)
        ## list of 10-logits (predicted) for each input sample
        #logits_list = tf.unpack(logits_out)
        ## list of 10-logits (actual label) for each input sample
        #labels_list = tf.unpack(labels_out)

        ## loop over all input samples
        #for i, l in enumerate(logits_list):
        #    print("Sample: "+str(i))
        #    predicted_cats = tf.unpack(l)
        #    actual_cats = tf.unpack(labels_list[i])
        #    print("output-predictions (softmaxed): "+str(session.run(tf.nn.softmax(predicted_cats))))
        #    print("output-labels: "+str(session.run(actual_cats)))
        


epochs = 1
batch_size = 2048
keep_probability = 1.0 # making this smaller 1.0 usually gives me worse results (I'm guessing my model is too simple to be needing dropout at all)


myModel = MyNet("test_conv_nn", 3)

"""
print('Checking the Training on a Single Batch...')
with tf.Session() as sess:
    ## Initializing the variables
    #sess.run(tf.global_variables_initializer())
    
    # Training cycle -> this will be the algorithm
    for epoch in range(epochs):
        batch_i = 1
        i = 0
        for batch_features, batch_labels in helper.load_preprocess_training_batch(batch_i, batch_size):
            #print("training mini-batch {:d} Len-features={:d} Len-labels={:d}".format(i, len(batch_features), len(batch_labels)))
            myModel.train(sess, {"keep_prob": keep_probability, "x": batch_features, "y": batch_labels}, init=True if epoch == 0 and i == 0 else False)
            i += 1

        print('Epoch {:>2}/{:d}, CIFAR-10 Batch {:d}:'.format(epoch + 1, epochs, batch_i))
        print('Training Set: ', end='')
        myModel.print_stats(sess, batch_features, batch_labels)
        
"""

# ### Fully Train the Model
# Now that you got a good accuracy with a single CIFAR-10 batch, try it with all five batches.

# In[ ]:


print('Training...')
with tf.Session() as sess:
    # Initializing the variables
    sess.run(tf.global_variables_initializer())
    
    # Training cycle
    for epoch in range(epochs):
        # Loop over all CIFAR-10 batches
        n_batches = 5
        for batch_i in range(1, n_batches + 1):
            for batch_features, batch_labels in helper.load_preprocess_training_batch(batch_i, batch_size):
                sess.run(myModel.get_output("train_op"), feed_dict={
                    myModel.get_feed("keep_prob"): keep_probability,
                    myModel.get_feed("x"): batch_features,
                    myModel.get_feed("y"): batch_labels})

                myModel.print_stats(sess, batch_features, batch_labels)
            print('Epoch {:>2}, CIFAR-10 Batch {}:'.format(epoch + 1, batch_i),)
            print('Training Set: ', end='')

        # CORRECTION: print out validation loss and accuracy
        # also, using the print_stats function now instead of 'custom' code
        #print('Validation Set: ', end='')
        #print_stats(sess, valid_feature_batch, valid_label_batch, cost, accuracy)
        #print("")
    
    # Save Model's variables
    myModel.save_state(sess)


"""
import tensorflow as tf
import pickle
import helper
import random

# Set batch size if not already set
try:
    if batch_size:
        pass
except NameError:
    batch_size = 64

save_model_path = './image_classification'
n_samples = 4
top_n_predictions = 3

def test_model():
    #Test the saved model against the test dataset

    test_features, test_labels = pickle.load(open('preprocess_training.p', mode='rb'))
    loaded_graph = tf.Graph()

    with tf.Session(graph=loaded_graph) as sess:
        # Load model
        loader = tf.train.import_meta_graph(save_model_path + '.meta')
        loader.restore(sess, save_model_path)

        # Get Tensors from loaded model
        loaded_x = loaded_graph.get_tensor_by_name('x:0')
        loaded_y = loaded_graph.get_tensor_by_name('y:0')
        loaded_keep_prob = loaded_graph.get_tensor_by_name('keep_prob:0')
        loaded_logits = loaded_graph.get_tensor_by_name('logits:0')
        loaded_acc = loaded_graph.get_tensor_by_name('accuracy:0')
        
        # Get accuracy in batches for memory limitations
        test_batch_acc_total = 0
        test_batch_count = 0
        
        for train_feature_batch, train_label_batch in helper.batch_features_labels(test_features, test_labels, batch_size):
            test_batch_acc_total += sess.run(
                loaded_acc,
                feed_dict={loaded_x: train_feature_batch, loaded_y: train_label_batch, loaded_keep_prob: 1.0})
            test_batch_count += 1

        print('Testing Accuracy: {}\n'.format(test_batch_acc_total/test_batch_count))

        # Print Random Samples
        random_test_features, random_test_labels = tuple(zip(*random.sample(list(zip(test_features, test_labels)), n_samples)))
        random_test_predictions = sess.run(
            tf.nn.top_k(tf.nn.softmax(loaded_logits), top_n_predictions),
            feed_dict={loaded_x: random_test_features, loaded_y: random_test_labels, loaded_keep_prob: 1.0})
        helper.display_image_predictions(random_test_features, random_test_labels, random_test_predictions)


test_model()
"""

# ## Why 50-70% Accuracy?
# You might be wondering why you can't get an accuracy any higher. First things first, 50% isn't bad for a simple CNN.  Pure guessing would get you 10% accuracy. However, you might notice people are getting scores [well above 70%](http://rodrigob.github.io/are_we_there_yet/build/classification_datasets_results.html#43494641522d3130).  That's because we haven't taught you all there is to know about neural networks. We still need to cover a few more techniques.
# ## Submitting This Project
# When submitting this project, make sure to run all the cells before saving the notebook.  Save the notebook file as "dlnd_image_classification.ipynb" and save it as a HTML file under "File" -> "Download as".  Include the "helper.py" and "problem_unittests.py" files in your submission.

# ## Trying my daughter's (7) frog painting :)
# 

# In[ ]:


"""import matplotlib.pyplot as plt
from matplotlib.image import imread
import helper

image1 = imread("/home/ubuntu/deep-learning/image-classification/katis_frog.png")
image2 = imread("/home/ubuntu/deep-learning/image-classification/henrik_auto.png")
image3 = imread("/home/ubuntu/deep-learning/image-classification/katis_dog.png")

f, ax = plt.subplots(3, sharey=True)
ax[0].set_title('picture 0')
ax[0].imshow(image1)
ax[1].set_title('picture 1')
ax[1].imshow(image2)
ax[2].set_title('picture 2')
ax[2].imshow(image3)
#plt.xlim(0, 32)
#plt.ylim(32, 0)

# slice away alpha channel
def slice_alpha(image):
    return image[:,:,:-1]
    
image1 = slice_alpha(image1)
image2 = slice_alpha(image2)
image3 = slice_alpha(image3)

# fill up image array (1st dim of input tensor)
images = [image1, image2, image3]

loaded_graph = tf.Graph()
label_names = helper._load_label_names()

with tf.Session(graph=loaded_graph) as sess:
    # Load model
    loader = tf.train.import_meta_graph(save_model_path + '.meta')
    loader.restore(sess, save_model_path)

    # Get Tensors from loaded model
    loaded_x = loaded_graph.get_tensor_by_name('x:0')
    loaded_keep_prob = loaded_graph.get_tensor_by_name('keep_prob:0')
    loaded_logits = loaded_graph.get_tensor_by_name('logits:0')
        
    predictions = sess.run(tf.argmax(loaded_logits, 1), feed_dict={loaded_x: images, loaded_keep_prob: 1.0})

#print(predictions)

for i,pred in enumerate(predictions):
    print("Picture {:d} is showing a {:s}".format(i,label_names[pred]))


"""


def predict(self, session, inputs):
    predictions = session.run(self._predictions, feed_dict=self.get_feed_dict())
