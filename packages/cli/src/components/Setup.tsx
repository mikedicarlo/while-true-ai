import React, { useState } from "react";
import { Box, Text, useApp } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { getConfigDir } from "@while-true-ai/core";

type SetupStep = "provider" | "model" | "apiKey" | "done";

interface ProviderChoice {
  label: string;
  value: string;
  adapter: string;
  models: { label: string; value: string }[];
  envVar: string;
  baseUrl?: string;
}

const providers: ProviderChoice[] = [
  {
    label: "OpenAI",
    value: "openai",
    adapter: "openai",
    envVar: "OPENAI_API_KEY",
    models: [
      { label: "GPT-4o (recommended)", value: "gpt-4o" },
      { label: "GPT-4o mini (faster, cheaper)", value: "gpt-4o-mini" },
      { label: "GPT-4.1", value: "gpt-4.1" },
    ],
  },
  {
    label: "Anthropic",
    value: "anthropic",
    adapter: "anthropic",
    envVar: "ANTHROPIC_API_KEY",
    models: [
      { label: "Claude Sonnet 4 (recommended)", value: "claude-sonnet-4-20250514" },
      { label: "Claude Opus 4", value: "claude-opus-4-20250514" },
      { label: "Claude Haiku 3.5", value: "claude-haiku-4-5-20251001" },
    ],
  },
  {
    label: "Google",
    value: "google",
    adapter: "google",
    envVar: "GOOGLE_API_KEY",
    models: [
      { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
      { label: "Gemini 2.5 Flash (faster)", value: "gemini-2.5-flash" },
    ],
  },
  {
    label: "Kimi K2.5 (Moonshot AI)",
    value: "kimi",
    adapter: "openai",
    envVar: "MOONSHOT_API_KEY",
    baseUrl: "https://api.moonshot.cn/v1",
    models: [{ label: "Kimi K2.5", value: "kimi-k2.5" }],
  },
  {
    label: "Ollama (local)",
    value: "ollama",
    adapter: "ollama",
    envVar: "",
    models: [
      { label: "Llama 3.3 70B", value: "llama3.3:70b" },
      { label: "Llama 3.3 8B", value: "llama3.3:8b" },
      { label: "Qwen 2.5 32B", value: "qwen2.5:32b" },
    ],
  },
];

interface Props {
  onComplete: () => void;
}

export function Setup({ onComplete }: Props) {
  const [step, setStep] = useState<SetupStep>("provider");
  const [selectedProvider, setSelectedProvider] = useState<ProviderChoice | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const { exit } = useApp();

  const handleProviderSelect = (item: { value: string }) => {
    const provider = providers.find((p) => p.value === item.value);
    if (provider) {
      setSelectedProvider(provider);
      if (provider.models.length === 1) {
        setSelectedModel(provider.models[0].value);
        if (provider.value === "ollama") {
          saveConfig(provider, provider.models[0].value, "");
          return;
        }
        // Check if env var is set
        if (process.env[provider.envVar]) {
          saveConfig(provider, provider.models[0].value, "");
          return;
        }
        setStep("apiKey");
      } else {
        setStep("model");
      }
    }
  };

  const handleModelSelect = (item: { value: string }) => {
    setSelectedModel(item.value);
    if (selectedProvider) {
      if (selectedProvider.value === "ollama") {
        saveConfig(selectedProvider, item.value, "");
        return;
      }
      if (process.env[selectedProvider.envVar]) {
        saveConfig(selectedProvider, item.value, "");
        return;
      }
      setStep("apiKey");
    }
  };

  const handleApiKeySubmit = (key: string) => {
    if (selectedProvider && selectedModel) {
      saveConfig(selectedProvider, selectedModel, key.trim());
    }
  };

  const saveConfig = (provider: ProviderChoice, model: string, key: string) => {
    const configDir = getConfigDir();
    fs.mkdirSync(configDir, { recursive: true });

    const providerConfig: Record<string, unknown> = {
      modelId: model,
      adapter: provider.adapter,
      purpose: "chat",
      maxTokens: 4096,
      temperature: 0.7,
    };

    if (provider.baseUrl) {
      providerConfig.baseUrl = provider.baseUrl;
    }

    if (key) {
      providerConfig.apiKeyEnv = provider.envVar;
      // Save credentials separately
      const credPath = path.join(configDir, "credentials.yaml");
      const creds: Record<string, string> = {};
      creds[provider.envVar] = key;
      fs.writeFileSync(credPath, yaml.dump(creds));
    } else if (provider.envVar) {
      providerConfig.apiKeyEnv = provider.envVar;
    }

    const config = {
      providers: [providerConfig],
    };

    const configPath = path.join(configDir, "config.yaml");
    fs.writeFileSync(configPath, yaml.dump(config));

    setStep("done");
    setTimeout(onComplete, 1500);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          while-true-ai setup
        </Text>
      </Box>

      {step === "provider" && (
        <Box flexDirection="column">
          <Text>Select your LLM provider:</Text>
          <Box marginTop={1}>
            <SelectInput
              items={providers.map((p) => ({
                label: p.label,
                value: p.value,
              }))}
              onSelect={handleProviderSelect}
            />
          </Box>
        </Box>
      )}

      {step === "model" && selectedProvider && (
        <Box flexDirection="column">
          <Text>
            Select a model for {selectedProvider.label}:
          </Text>
          <Box marginTop={1}>
            <SelectInput
              items={selectedProvider.models}
              onSelect={handleModelSelect}
            />
          </Box>
        </Box>
      )}

      {step === "apiKey" && selectedProvider && (
        <Box flexDirection="column">
          <Text>
            Enter your {selectedProvider.label} API key
            {selectedProvider.envVar && (
              <Text dimColor> (or set {selectedProvider.envVar} env var)</Text>
            )}
            :
          </Text>
          <Box marginTop={1}>
            <Text color="cyan">{">"} </Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleApiKeySubmit}
              mask="*"
              placeholder="sk-..."
            />
          </Box>
        </Box>
      )}

      {step === "done" && (
        <Box flexDirection="column">
          <Text color="green" bold>
            Setup complete!
          </Text>
          <Text>
            Config saved to ~/.while-true-ai/config.yaml
          </Text>
          <Text dimColor>Starting agent...</Text>
        </Box>
      )}
    </Box>
  );
}
