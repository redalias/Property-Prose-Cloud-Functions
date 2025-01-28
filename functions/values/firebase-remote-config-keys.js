const firebaseRemoteConfigKeys = {
  prompt: {
    allCopy: {
      free: "prompt_all_copy_free",
      pro: "prompt_all_copy_pro",
    },
    contextualCopy: {
      free: "prompt_contextual_copy_free",
      pro: "prompt_contextual_copy_pro",
    },
    singleCopy: {
      free: "prompt_single_copy_free",
      pro: "prompt_single_copy_pro",
    }
  },

  maximumFreeCopyGenerations: "maximum_free_copy_generations",

  jsonSchema: {
    allCopy: {
      free: "json_schema_all_copy_free",
      pro: "json_schema_all_copy_pro",
    },
    contextualCopy: {
      free: "json_schema_contextual_copy_free",
      pro: "json_schema_contextual_copy_pro",
    },
    singleCopy: {
      free: "json_schema_single_copy_free",
      pro: "json_schema_single_copy_pro",
    }
  },
};

module.exports = firebaseRemoteConfigKeys;
