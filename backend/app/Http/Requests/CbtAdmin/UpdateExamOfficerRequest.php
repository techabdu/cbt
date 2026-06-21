<?php

namespace App\Http\Requests\CbtAdmin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateExamOfficerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $officer   = $this->route('exam_officer');
        $schoolId  = $officer?->school_id;

        return [
            'name'      => ['required', 'string', 'max:255'],
            'email'     => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($officer)],
            'is_active' => ['required', 'boolean'],
            'department_id' => ['nullable', 'integer',
                Rule::exists('departments', 'id')->where('school_id', $schoolId)],
        ];
    }
}
