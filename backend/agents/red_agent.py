
from pathlib import Path
from PIL import Image, ImageEnhance


class RedAgent:
    """
    Generates controlled visual test variants.
    This is a deterministic testing component,
    not yet a Meta-powered AI agent.
    """

    def __init__(self, output_dir):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_tests(self, image_path):
        image_path = Path(image_path)

        with Image.open(image_path) as img:
            image = img.convert("RGB")

        tests = [
            ("dark", ImageEnhance.Brightness(image).enhance(0.55)),
            ("bright", ImageEnhance.Brightness(image).enhance(1.4)),
            ("low_contrast", ImageEnhance.Contrast(image).enhance(0.6)),
            ("high_contrast", ImageEnhance.Contrast(image).enhance(1.4)),
        ]

        generated = []

        for test_name, test_image in tests:
            output_path = (
                self.output_dir /
                f"{image_path.stem}_{test_name}.png"
            )

            test_image.save(output_path)

            generated.append({
                "test": test_name,
                "source": str(image_path),
                "image": str(output_path)
            })

        return generated
