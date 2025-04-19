const firebaseRemoteConfigKeys = {
  prompt: {
    allCopy: "prompt_all_copy",
    contextualCopy: "prompt_contextual_copy",
    singleCopy: "prompt_single_copy",
  },

  llm: {
    model_id: "llm_model_id",
    retry_count: "llm_max_retry_count",
    retry_delay: "llm_retry_delay_milliseconds",
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
