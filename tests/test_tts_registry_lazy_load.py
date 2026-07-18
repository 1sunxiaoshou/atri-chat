import importlib


def test_tts_package_import_does_not_eagerly_register_all_providers():
    registry_module = importlib.import_module("core.tts.registry")
    registry_module.TTSRegistry._providers.clear()

    importlib.import_module("core.tts")

    assert registry_module.TTSRegistry._providers == {}


def test_tts_registry_lazy_loads_provider_on_demand():
    registry_module = importlib.import_module("core.tts.registry")
    registry_module.TTSRegistry._providers.clear()

    provider_class = registry_module.TTSRegistry.get_provider_class("gpt_sovits")

    assert provider_class.__name__ == "GPTSoVITSTTS"
    assert "gpt_sovits" in registry_module.TTSRegistry.get_all_providers()
