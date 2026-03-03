type ElementImage = {
  title: string;
  url: string;
  attribution: string;
};

type ElementProps = {
  name: string;
  appearance: string | null;
  atomic_mass: number;
  boil: number | null;
  category: string;
  density: number | null;
  discovered_by: string | null;
  melt: number | null;
  molar_heat: number | null;
  named_by: string | null;
  number: number;
  period: number;
  group: number;
  phase: string;
  source: string;
  bohr_model_image: string | null;
  bohr_model_3d: string | null;
  spectral_img: string | null;
  summary: string;
  symbol: string;
  xpos: number;
  ypos: number;
  wxpos: number;
  wypos: number;
  shells: number[];
  electron_configuration: string;
  electron_configuration_semantic: string;
  electron_affinity: number | null;
  electronegativity_pauling: number | null;
  ionization_energies: number[];
  cpk_hex: string | null;
  image: ElementImage;
  block: string;
};

class Element implements ElementProps {
  readonly name!: string;
  readonly appearance!: string | null;
  readonly atomic_mass!: number;
  readonly boil!: number | null;
  readonly category!: string;
  readonly density!: number | null;
  readonly discovered_by!: string | null;
  readonly melt!: number | null;
  readonly molar_heat!: number | null;
  readonly named_by!: string | null;
  readonly number!: number;
  readonly period!: number;
  readonly group!: number;
  readonly phase!: string;
  readonly source!: string;
  readonly bohr_model_image!: string | null;
  readonly bohr_model_3d!: string | null;
  readonly spectral_img!: string | null;
  readonly summary!: string;
  readonly symbol!: string;
  readonly xpos!: number;
  readonly ypos!: number;
  readonly wxpos!: number;
  readonly wypos!: number;
  readonly shells!: number[];
  readonly electron_configuration!: string;
  readonly electron_configuration_semantic!: string;
  readonly electron_affinity!: number | null;
  readonly electronegativity_pauling!: number | null;
  readonly ionization_energies!: number[];
  readonly cpk_hex!: string | null;
  readonly image!: ElementImage;
  readonly block!: string;

  constructor(props: ElementProps) {
    Object.assign(this, props, {
      shells: [...props.shells],
      ionization_energies: [...props.ionization_energies],
      image: { ...props.image },
    });
  }
}

export default Element;
export type { ElementImage, ElementProps };
